import { z } from "zod";
import type { InfraiClient } from "./infrai_client.js";

export const buildEventSchema = z.object({
  eventId: z.string().min(1),
  jobId: z.string().min(1),
  releaseId: z.string().min(1),
  commitSha: z.string().regex(/^[a-f0-9]{7,40}$/i),
  outcome: z.enum(["succeeded", "failed"]),
  durationMs: z.number().int().nonnegative(),
  diagnostic: z.string().min(1).optional()
}).superRefine((event, context) => {
  if (event.outcome === "failed" && !event.diagnostic) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diagnostic"],
      message: "failed builds require a developer-facing diagnostic"
    });
  }
});

export type BuildEvent = z.infer<typeof buildEventSchema>;

export function toStructuredLog(event: BuildEvent, environment: string) {
  const failed = event.outcome === "failed";
  return {
    timestamp: new Date().toISOString(),
    level: failed ? "error" : "info",
    message: failed ? "build blocked release" : "build cleared for release",
    service: "release-worker",
    environment,
    event_id: event.eventId,
    job_id: event.jobId,
    release_id: event.releaseId,
    commit_sha: event.commitSha,
    outcome: event.outcome,
    duration_ms: event.durationMs,
    diagnostic: event.diagnostic
  };
}

export function createBuildReleaseLog(infrai: InfraiClient, environment: string) {
  return {
    async record(input: unknown) {
      const event = buildEventSchema.parse(input);
      const entry = toStructuredLog(event, environment);
      const [ingested, credential] = await Promise.all([
        infrai.logs.ingest([entry], event.eventId),
        infrai.account.whoami()
      ]);
      return { entry, ingested, credential };
    },

    async search(releaseId: string) {
      return infrai.logs.search({
        q: `release_id:${releaseId}`,
        service: "release-worker",
        environment,
        limit: 50
      });
    }
  };
}

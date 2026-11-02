import assert from "node:assert/strict";
import test from "node:test";
import { buildEventSchema, toStructuredLog } from "../src/build_release_log.js";

test("a failed build becomes an error diagnostic and cannot omit its reason", () => {
  const missingDiagnostic = buildEventSchema.safeParse({
    eventId: "build-42",
    jobId: "compile-web",
    releaseId: "release-17",
    commitSha: "8f31bd2",
    outcome: "failed",
    durationMs: 904
  });
  assert.equal(missingDiagnostic.success, false);

  const event = buildEventSchema.parse({
    eventId: "build-42",
    jobId: "compile-web",
    releaseId: "release-17",
    commitSha: "8f31bd2",
    outcome: "failed",
    durationMs: 904,
    diagnostic: "TypeScript compilation failed in packages/cli"
  });
  const entry = toStructuredLog(event, "staging");

  assert.equal(entry.level, "error");
  assert.equal(entry.message, "build blocked release");
  assert.equal(entry.release_id, "release-17");
  assert.equal(entry.diagnostic, "TypeScript compilation failed in packages/cli");
});

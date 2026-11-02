import { createBuildReleaseLog } from "./build_release_log.js";
import { createInfraiClient } from "./infrai_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example");

const releaseLogs = createBuildReleaseLog(createInfraiClient({ apiKey }), "staging");
const eventId = `build-example-${Date.now()}`;

const recorded = await releaseLogs.record({
  eventId,
  jobId: "compile-web-1842",
  releaseId: "release-2026-09-18",
  commitSha: "8f31bd2",
  outcome: "succeeded",
  durationMs: 18_420
});
const matches = await releaseLogs.search("release-2026-09-18");

console.log(JSON.stringify({ recorded, matches }, null, 2));

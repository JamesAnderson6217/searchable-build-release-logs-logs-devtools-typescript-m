import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { createBuildReleaseLog } from "./build_release_log.js";
import { createInfraiClient, InfraiError } from "./infrai_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const port = Number(process.env.PORT ?? 3000);
const environment = process.env.APP_ENV ?? "development";
const releaseLogs = createBuildReleaseLog(createInfraiClient({ apiKey }), environment);

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (request.method === "POST" && url.pathname === "/build-events") {
      send(response, 202, await releaseLogs.record(await readJson(request)));
      return;
    }
    if (request.method === "GET" && url.pathname === "/release-logs") {
      const releaseId = url.searchParams.get("releaseId");
      if (!releaseId) {
        send(response, 400, { error: "releaseId is required" });
        return;
      }
      send(response, 200, await releaseLogs.search(releaseId));
      return;
    }
    send(response, 404, { error: "route not found" });
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "invalid build event", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, message: error.message });
      return;
    }
    send(response, 500, { error: "request failed" });
  }
}).listen(port, () => {
  console.log(`release log service listening on http://localhost:${port}`);
});

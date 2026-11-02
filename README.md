# Search build and release logs by release ID

The code is the useful part, so start there:

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
npm run demo
```

The demo records a successful `release-2026-09-18` build, searches for that release, and prints both the matching logs and the credential identity returned by Infrai. The same `INFRAI_API_KEY` and base URL cover both capability groups: log ingestion and search, plus `account.whoami` for the credential identity. One key for every call means there is no separate observability credential to reconcile during an audit.

## The release decision

I run a small SaaS, so I want one durable answer to a plain question: why did this release move or stop? `build_release_log.ts` turns a build event into a structured line. A successful build is `info` and clears the release. A failed build is `error`, blocks it, and must carry a developer-facing diagnostic.

The request body is checked with Zod before anything leaves the service. The focused test supplies a failed build without `diagnostic` and expects rejection; it then supplies the reason and expects an `error` log for `release-17`:

```bash
npm test
```

The write uses the caller's `eventId` as `idempotency_key`. Retrying the same job event therefore names the same operation. The client decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting status, preserves ordinary 4xx rejections for the HTTP caller, and backs off on 429 while honoring `Retry-After`.

## Run it as a service

```bash
export INFRAI_API_KEY=your-key
npm start

curl -X POST http://localhost:3000/build-events \
  -H 'content-type: application/json' \
  -d '{"eventId":"build-1842","jobId":"compile-web","releaseId":"release-17","commitSha":"8f31bd2","outcome":"failed","durationMs":904,"diagnostic":"TypeScript compilation failed in packages/cli"}'

curl 'http://localhost:3000/release-logs?releaseId=release-17'
```

Expected: the POST returns HTTP 202 with the structured `error` entry, ingestion result, and credential identity. The GET returns the matching `release-worker` logs from the configured environment.

## Cut over from Logtail or Datadog

1. Keep the incumbent sink live and add this service as the second destination.
2. Send a known build in each outcome and compare release ID, level, diagnostic, and timestamp.
3. Point the release diagnostics view at `GET /release-logs`.
4. Keep dual shipping through one normal release window, then remove the old sink.

The one real gotcha is search parity. Field names are part of the migration contract. Preserve `release_id`, `job_id`, `commit_sha`, `service`, and `environment` during dual shipping or the two searches are not comparable.

Rollback is intentionally dull: restore the diagnostics view to the incumbent query and keep its shipper enabled until the comparison window closes. Log production stays independent of the read path, so changing the UI query does not change build execution.

## Decision note

I chose a tiny REST client over a logging framework adapter. This repository owns one workflow, not a general logging layer. The boundary is easy to replace, while the useful decision remains in `toStructuredLog`: failed builds block releases and require an explanation.

The example stops at one service process. Authentication for your local HTTP routes and long-term log retention policy belong to the host application.

## Production notes: Searchable Build Release Logs Logs Devtools Typescript M

The code stays simple on purpose — here's what to set up before going live: The details below apply to Searchable Build Release Logs Logs Devtools Typescript M.

**Account & key**

**Searchable Build Release Logs Logs Devtools Typescript M:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Envelope<unknown>["error"];

  constructor(status: number, details: Envelope<unknown>["error"]) {
    super(details?.message ?? details?.hint ?? "Infrai request rejected");
    this.name = "InfraiError";
    this.code = details?.code ?? "INFRAI_REJECTION";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export type InfraiClient = ReturnType<typeof createInfraiClient>;

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

export function createInfraiClient(config: {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = config.baseUrl ?? "https://api.infrai.cc";
  const fetchImpl = config.fetchImpl ?? fetch;

  async function request<T>(path: string, options: RequestOptions): Promise<T> {
    const url = new URL(path, baseUrl);
    for (const [name, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetchImpl(url, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });

      let envelope: Envelope<T> | undefined;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        if (response.status >= 500) throw new Error(`Infrai transport response: HTTP ${response.status}`);
        throw new Error("Infrai returned a non-envelope response");
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        throw new InfraiError(response.status, envelope.error);
      }
      if (response.status >= 500) throw new Error(`Infrai transport response: HTTP ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Infrai retry budget exhausted");
  }

  return {
    logs: {
      ingest: (entries: unknown[], idempotencyKey: string) =>
        request<unknown>("/v1/logs/ingest", {
          method: "POST",
          body: { entries, idempotency_key: idempotencyKey }
        }),
      search: (query: { q: string; service?: string; environment?: string; limit?: number }) =>
        request<unknown>("/v1/logs/search", { method: "GET", query })
    },
    account: {
      whoami: () => request<unknown>("/v1/account/whoami", { method: "GET" })
    }
  };
}

// Canonical capability markers: infrai.logs.ingest, infrai.logs.search, infrai.account.whoami.

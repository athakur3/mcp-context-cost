/**
 * What a remote MCP endpoint says to a request that carries no credential.
 *
 * `audit` used to skip every `url` entry as `remote-not-measurable`, which
 * under-counted exactly the stacks the audit is for — vendors are moving to
 * hosted endpoints. The obvious fix, handing every url to the `mcp-remote`
 * bridge the sweep already measures open endpoints through, is wrong on a
 * developer machine: against an OAuth-walled endpoint mcp-remote opens a
 * browser window and waits for the callback (its README says so), which an
 * audit has no business doing once per server in someone's config; and in a
 * headless run it waits until this harness's timeout, so the row would read
 * `timeout` — a word that blames the clock for a credential.
 *
 * So the endpoint is asked first, with the request every MCP session begins
 * with: `initialize` over streamable HTTP, then a GET with an event-stream
 * `accept` for an SSE endpoint that refuses POST. Probed 2026-09-06 from this
 * repository: `mcp.linear.app/mcp`, `mcp.zapier.com/api/mcp/mcp` and
 * `mcp.vercel.com` each answer `401` with a `WWW-Authenticate: Bearer …`
 * header naming the OAuth resource; `mcp.deepwiki.com/mcp`, `learn.microsoft.com/api/mcp`,
 * `docs.mcp.cloudflare.com/sse` and `huggingface.co/mcp` answer `200` with a
 * session or a stream. Nothing is inferred from a hostname: the status line
 * and the header are the server's own words, and the report quotes them.
 *
 * Only an endpoint that answered without a credential is handed to the
 * bridge, so the bridge never has a reason to open a browser. Header VALUES a
 * config carries (a static bearer token) are sent with the probe and the
 * bridge, exactly as env values are spawned into a stdio server, and never
 * written to a report — see `ConfiguredServer.headers` in config.ts.
 */

export interface RemoteProbe {
  /**
   * `open`: answered the unauthenticated request as an MCP endpoint does.
   * `auth-walled`: answered 401 or 403 — it works, and it wants a credential
   * this audit does not hold. `unreachable`: no MCP answer arrived — a
   * connection failure, a timeout, or a status that is neither of the above.
   */
  kind: 'open' | 'auth-walled' | 'unreachable';
  /** The HTTP status that decided it, when a response arrived at all. */
  status?: number;
  /** The `WWW-Authenticate` header, verbatim (clipped), when the server sent one. */
  wwwAuthenticate?: string;
  /** One line a report can print: the server's own words, or the failure's. */
  detail: string;
}

/** The first request of every MCP session, which is all a probe needs to send. */
const INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'mcp-context-cost', version: '0' },
  },
});

/** Long enough to be quoted whole in a report, short enough not to be the report. */
const CLIP = 300;
const clip = (s: string): string => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > CLIP ? `${one.slice(0, CLIP)}…` : one;
};

/** What a probe waits for an answer, unless the caller says otherwise. */
export const DEFAULT_PROBE_TIMEOUT_MS = 15_000;

/**
 * Ask one endpoint, once, and report what it said.
 *
 * Never throws: an endpoint this could not reach is a probe result, not a
 * crash, because the audit goes on to the next server either way.
 */
export async function probeRemote(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<RemoteProbe> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const configured = opts.headers ?? {};

  const attempt = async (init: RequestInit): Promise<Response> => {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
    // The headers are the answer. The body is not read — an event stream
    // stays open for the life of a session, and this is not a session.
    try {
      await res.body?.cancel();
    } catch {
      /* a body that refuses to be cancelled changes nothing the headers said */
    }
    return res;
  };

  try {
    let res = await attempt({
      method: 'POST',
      headers: {
        ...configured,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
      },
      body: INITIALIZE,
    });
    // The older SSE transport opens its stream on GET and may refuse the POST
    // outright; an endpoint that does is asked the way it expects to be.
    if (res.status === 404 || res.status === 405) {
      res = await attempt({ method: 'GET', headers: { ...configured, accept: 'text/event-stream' } });
    }
    return classify(res);
  } catch (e) {
    return { kind: 'unreachable', detail: describeFailure(e, timeoutMs) };
  }
}

function classify(res: Response): RemoteProbe {
  const www = res.headers.get('www-authenticate');
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (res.status === 401 || res.status === 403) {
    return {
      kind: 'auth-walled',
      status: res.status,
      ...(www ? { wwwAuthenticate: clip(www) } : {}),
      detail: `HTTP ${res.status}${www ? ` — WWW-Authenticate: ${clip(www)}` : ''}`,
    };
  }
  if (res.ok) {
    // A JSON-RPC answer or an event stream is what an MCP endpoint sends. A
    // 200 carrying HTML is a login page or a docs site at that address.
    if (type === 'application/json' || type === 'text/event-stream') {
      return { kind: 'open', status: res.status, detail: `HTTP ${res.status} ${type}` };
    }
    return {
      kind: 'unreachable',
      status: res.status,
      detail: `HTTP ${res.status} with ${type || 'no content-type'}, which is not an MCP response`,
    };
  }
  return { kind: 'unreachable', status: res.status, detail: `HTTP ${res.status}` };
}

function describeFailure(e: unknown, timeoutMs: number): string {
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return `no answer within ${timeoutMs}ms`;
  // Node's fetch wraps the socket error: "fetch failed" with the code underneath.
  const code = err?.cause?.code;
  if (code) return code;
  return err?.cause?.message ?? err?.message ?? String(e);
}

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
import { PROTOCOL_VERSION } from '../core/protocol.js';

export interface RemoteProbe {
  /**
   * `open`: answered the unauthenticated request as an MCP endpoint does.
   * `auth-walled`: answered 401 or 403 — it works, and it wants a credential
   * this audit does not hold. `protocol-mismatch`: answered by refusing the
   * revision this probe sent, naming it — it works, and this audit speaks the
   * wrong version at it. `unreachable`: no MCP answer arrived — a connection
   * failure, a timeout, or a status that is neither of the above.
   */
  kind: 'open' | 'auth-walled' | 'protocol-mismatch' | 'unreachable';
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
    protocolVersion: PROTOCOL_VERSION,
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

/** A response and, when one was worth reading, the start of its body. */
interface Answer {
  res: Response;
  body: string | null;
}

/** Long enough for a JSON-RPC error, short enough that a stray HTML page cannot be the report. */
const BODY_CAP = 8_192;

/**
 * The start of a response body, and no more of it.
 *
 * A cap rather than `res.text()` because this reads bodies from endpoints
 * nobody here controls: an error page can be any size, and the only part that
 * decides anything is the first few hundred bytes.
 */
async function firstBytes(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let out = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
      if (out.length >= BODY_CAP) break;
    }
  } catch {
    /* a body that stops arriving is still worth what did */
  } finally {
    await reader.cancel().catch(() => {});
  }
  return out.slice(0, BODY_CAP);
}

/**
 * The revisions a server named while refusing the one we sent, or null when the
 * body is not that refusal.
 *
 * Anchored on the code the schema defines for it, never on the status alone: a
 * 400 is also what a malformed request earns, and calling that a protocol
 * refusal would be a claim about the server made from a fact about us.
 */
export function refusedProtocol(
  body: string | null,
): { supported?: string[]; requested?: string } | null {
  if (!body) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const err = (parsed as { error?: { code?: unknown; data?: unknown } })?.error;
  if (!err || err.code !== -32022) return null;
  const data = (err.data ?? {}) as { supported?: unknown; requested?: unknown };
  return {
    ...(Array.isArray(data.supported) ? { supported: data.supported.map(String) } : {}),
    ...(typeof data.requested === 'string' ? { requested: data.requested } : {}),
  };
}

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
  opts: { headers?: Record<string, string> | undefined; timeoutMs?: number | undefined } = {},
): Promise<RemoteProbe> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const configured = opts.headers ?? {};

  const attempt = async (init: RequestInit): Promise<Answer> => {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    // The headers are usually the whole answer, and a success body is never
    // read: an event stream stays open for the life of a session, and this is
    // not a session. An error that is not a credential wall is the exception.
    // Under 2026-07-28 a server that does not support the version a request
    // carries MUST answer 400, and the only place it says so is the body — so
    // reading the headers alone would report a working endpoint as one that
    // never answered. That body is finite by construction, and read under the
    // same timeout and a byte cap besides.
    const wantsBody = !res.ok && res.status !== 401 && res.status !== 403;
    const body = wantsBody ? await firstBytes(res) : null;
    if (!wantsBody) {
      try {
        await res.body?.cancel();
      } catch {
        /* a body that refuses to be cancelled changes nothing the headers said */
      }
    }
    return { res, body };
  };

  try {
    let answer = await attempt({
      method: 'POST',
      headers: {
        ...configured,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': PROTOCOL_VERSION,
      },
      body: INITIALIZE,
    });
    // The older SSE transport opens its stream on GET and may refuse the POST
    // outright; an endpoint that does is asked the way it expects to be.
    if (answer.res.status === 404 || answer.res.status === 405) {
      answer = await attempt({
        method: 'GET',
        headers: { ...configured, accept: 'text/event-stream' },
      });
    }
    return classify(answer);
  } catch (e) {
    return { kind: 'unreachable', detail: describeFailure(e, timeoutMs) };
  }
}

function classify({ res, body }: Answer): RemoteProbe {
  const www = res.headers.get('www-authenticate');
  const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
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
  // Before the fall-through, and only on the server's own words: it answered,
  // and what it said was that it does not speak the revision this probe sent.
  // Calling that `unreachable` would say no MCP answer arrived, about a server
  // that answered.
  const refused = refusedProtocol(body);
  if (refused) {
    const supported = refused.supported?.length
      ? ` — it speaks ${refused.supported.join(', ')}`
      : '';
    return {
      kind: 'protocol-mismatch',
      status: res.status,
      detail: `HTTP ${res.status} refusing protocol version ${refused.requested ?? PROTOCOL_VERSION}${supported}`,
    };
  }
  return { kind: 'unreachable', status: res.status, detail: `HTTP ${res.status}` };
}

function describeFailure(e: unknown, timeoutMs: number): string {
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError')
    return `no answer within ${timeoutMs}ms`;
  // Node's fetch wraps the socket error: "fetch failed" with the code underneath.
  const code = err?.cause?.code;
  if (code) return code;
  return err?.cause?.message ?? err?.message ?? String(e);
}

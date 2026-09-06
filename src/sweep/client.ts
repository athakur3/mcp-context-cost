/**
 * Minimal MCP stdio client — deliberately NOT the official SDK: schema-parsing
 * layers can reorder/strip keys, and our canonical bytes are defined as the
 * tools array exactly as the wire carried it. JSON.parse preserves key order,
 * so the objects captured here ARE the wire representation.
 */
import { spawn } from 'node:child_process';

export interface WireCapture {
  serverInfo?: { name?: string; version?: string };
  protocolVersion?: string;
  tools: unknown[];
  /**
   * The `instructions` string from the initialize result — half of the
   * session-start load. `null` means the server returned none, which is a
   * different fact from never having asked, so the two are never conflated.
   */
  instructions: string | null;
  stderrTail: string;
}

interface Pending {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
}

const PROTOCOL_VERSION = '2025-06-18';

/** How an elided middle is marked, in every layout here. */
const ELISION = ' […] ';

/**
 * The part of a dead server's stderr worth keeping as evidence.
 *
 * A failure record is only useful if it contains the failure, and a plain tail
 * reliably keeps the least useful part. `npx` prints a deprecation warning per
 * transitive dependency and a version notice at the end, and a crashing process
 * prints its message *before* the stack — so the last N characters of stderr
 * are npm warnings and stack frames on exactly the servers whose failure needs
 * explaining. Several published records ended up saying nothing about why the
 * server did not start.
 *
 * This is not cosmetic. `run.ts` classifies a failure by reading these words:
 * a record whose message was cut off is filed as `startup-failure` — the server
 * is broken — when the surviving text would have said `auth-required`. Spending
 * the budget on the message rather than the frames is what keeps the published
 * taxonomy describing the server.
 *
 * Noise is only dropped while something else survives. A package that fails
 * *inside* npm (EBADPLATFORM, a failed postinstall) has npm's own lines as its
 * only evidence, and a server whose whole output is a stack keeps the stack.
 *
 * `required` is the phrase a declared entry's published status depends on
 * (`notApplicable.evidence` in servers.yaml). Everything else here is a budget
 * decision — how much of a long failure is worth publishing — but this one is
 * not. The entry says "this failure is the harness's, and here is the sentence
 * that proves it", and `notApplicableReason` re-reads that sentence out of what
 * survives: elide it and the declaration turns itself off, the row reverts to
 * `startup-failure`, and this project publishes that someone else's working
 * software is broken. The evidence is therefore kept whatever the budget, and
 * everything else competes for what is left — the rule the old one lacked, and
 * the reason it depended on how much the server happened to print.
 */
export function evidenceTail(stderr: string, limit = 600, required?: string): string {
  const needle = required ? required.toLowerCase() : undefined;
  const protect = (l: string) => needle !== undefined && l.toLowerCase().includes(needle);
  const withoutNoise = drop(stderr, (l) => /^npm (warn|notice)\b/.test(l), protect);
  const withoutFrames = drop(withoutNoise, (l) => /^at\s/.test(l), protect);
  return bothEnds(withoutFrames, limit, needle);
}

/**
 * Keep the start and the end, eliding the middle.
 *
 * Dropping npm noise and stack frames is not enough on its own: a CLI that
 * rejects its environment often prints one line saying why and then its entire
 * usage screen, which is neither. kubernetes-mcp-server does exactly that, and
 * a tail-only budget kept forty lines of flag documentation while discarding
 * "no current-context is set and no contexts are defined in kubeconfig" — the
 * only sentence in the output that explained anything.
 *
 * Failures put their explanation at one end or the other — a crash message
 * above its aftermath, or an error at the end of a log — so both ends are kept
 * and the middle is what goes. The split leans towards the head because a
 * message that precedes its own noise is the more common shape here.
 */
function bothEnds(text: string, limit: number, needle?: string): string {
  const kept = bothEndsPlain(text, limit);
  if (needle === undefined) return kept;
  // Only pay for the anchored layout when the ordinary one lost the phrase and
  // the raw text actually had it. An entry whose evidence never appeared is a
  // declaration that does not hold, and must keep failing as one.
  if (kept.toLowerCase().includes(needle)) return kept;
  if (!text.toLowerCase().includes(needle)) return kept;
  return aroundRequired(text, limit, needle);
}

function bothEndsPlain(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const elision = `\n${ELISION}\n`;
  const budget = Math.max(0, limit - elision.length);
  const lines = text.split('\n');

  // Whole lines only: a boundary cut mid-word ("ool/prompt change") reads as
  // corruption and loses the token an evidence string would match on.
  const take = (from: number, to: number, cap: number, fromEnd: boolean) => {
    const out: string[] = [];
    let used = 0;
    for (let i = fromEnd ? to : from; fromEnd ? i >= from : i <= to; i += fromEnd ? -1 : 1) {
      const cost = lines[i].length + 1;
      if (used + cost > cap) break;
      fromEnd ? out.unshift(lines[i]) : out.push(lines[i]);
      used += cost;
    }
    return { out, used };
  };

  const headCap = Math.ceil(budget * 0.6);
  const head = take(0, lines.length - 1, headCap, false);

  // Whole lines, except when the first line alone overruns the budget. A server
  // that logs structured JSON puts its entire message on one line, so that line
  // is both the most informative thing in the output and the only one that can
  // never fit — slack-mcp-server's `{"level":"fatal","message":"Authentication
  // required: ..."}` was dropped in full, and the record it left behind said a
  // child process exited. Truncated evidence beats none.
  const headText = head.out.length > 0 ? head.out.join('\n') : lines[0].slice(0, headCap);
  const headUsed = head.out.length > 0 ? head.used : headText.length;
  const tailFrom = head.out.length > 0 ? head.out.length : 1;

  const tail = take(tailFrom, lines.length - 1, budget - headUsed, true);
  if (headText === '' && tail.out.length === 0) return text.slice(0, budget) + elision;
  return `${headText}${elision}${tail.out.join('\n')}`;
}

/**
 * Keep the line the declared evidence is on, then spend what is left on context.
 *
 * Head before tail, the same lean `bothEndsPlain` takes and for the same reason:
 * an explanation usually precedes its own aftermath. The elisions are marked, so
 * a reader of the record can see that something was dropped around the sentence
 * that was not.
 */
function aroundRequired(text: string, limit: number, needle: string): string {
  const lines = text.split('\n');
  const k = lines.findIndex((l) => l.toLowerCase().includes(needle));
  // Both elisions and the newlines joining at most five chunks, reserved before
  // the anchor is sized: the budget is a published-record limit, and a layout
  // that keeps the evidence by overrunning it has only moved the problem.
  const reserve = 2 * ELISION.length + 4;
  const anchor = windowAround(lines[k], needle, Math.max(needle.length, limit - reserve));

  let budget = limit - anchor.length - reserve;
  const head: string[] = [];
  for (let i = 0; i < k; i++) {
    const cost = lines[i].length + 1;
    if (cost > budget) break;
    head.push(lines[i]);
    budget -= cost;
  }
  const tail: string[] = [];
  for (let i = lines.length - 1; i > k; i--) {
    const cost = lines[i].length + 1;
    if (cost > budget) break;
    tail.unshift(lines[i]);
    budget -= cost;
  }

  const chunks: string[] = [];
  if (head.length) chunks.push(head.join('\n'));
  if (head.length < k) chunks.push(ELISION);
  chunks.push(anchor);
  if (tail.length < lines.length - 1 - k) chunks.push(ELISION);
  if (tail.length) chunks.push(tail.join('\n'));
  return chunks.join('\n');
}

/**
 * A single line that alone overruns the budget, kept as a window around the
 * match rather than from its start — a structured log puts the whole message on
 * one line, and the phrase that matters can sit anywhere in it.
 */
function windowAround(line: string, needle: string, limit: number): string {
  if (line.length <= limit) return line;
  const at = line.toLowerCase().indexOf(needle);
  const lead = Math.max(0, Math.floor((limit - needle.length) / 2));
  const start = Math.max(0, Math.min(at - lead, line.length - limit));
  return line.slice(start, start + limit);
}

/**
 * Cut a record's notes to `limit` without cutting away the evidence its own
 * status rests on.
 *
 * The same rule as `evidenceTail`, one layer up and for a different reason. The
 * classifier reads the message *before* this cut, so this one cannot change a
 * published status — it can only leave a record asserting `not-applicable` with
 * the sentence that justifies it deleted, which is a claim published without its
 * evidence. `windows-mcp` sits at exactly the cap today, so the margin here is
 * one character of growth in somebody else's error message.
 */
export function clampNotes(text: string, limit: number, required?: string): string {
  if (text.length <= limit) return text;
  const plain = text.slice(0, limit);
  if (!required) return plain;
  const needle = required.toLowerCase();
  if (plain.toLowerCase().includes(needle)) return plain;
  const at = text.toLowerCase().indexOf(needle);
  if (at < 0) return plain;
  const room = Math.max(0, limit - ELISION.length);
  const width = Math.min(room, Math.max(needle.length, Math.floor(room / 2)));
  const start = Math.max(0, Math.min(at - Math.floor((width - needle.length) / 2), text.length - width));
  return text.slice(0, Math.max(0, room - width)) + ELISION + text.slice(start, start + width);
}

/**
 * Drop matching lines, keeping the input whole if that would leave nothing.
 *
 * `isProtected` outranks `isNoise`: safari-mcp declares `EBADPLATFORM`, which npm
 * prints on a line of its own, and a filter that reaches it first would delete
 * the evidence before any budget was even applied.
 */
function drop(
  text: string,
  isNoise: (trimmedLine: string) => boolean,
  isProtected: (trimmedLine: string) => boolean = () => false,
): string {
  const kept = text
    .split('\n')
    .filter((l) => isProtected(l.trim()) || !isNoise(l.trim()))
    .join('\n')
    .trim();
  return kept || text.trim();
}

/**
 * A client posture: what it declares at `initialize`, and how it answers the
 * requests that declaration invites. The two live in one object because they
 * are one decision — a client that declares `roots` and then returns
 * "method not found" to `roots/list` has told the server something untrue, and
 * a server is entitled to shape its tool list around the answer.
 *
 * This exists because the default posture, `{}`, is not neutral. A server may
 * gate tools on what the client can do: measured 2026-09-06, the reference
 * `everything` server exposes 13 tools to a client declaring nothing and 15 to
 * one declaring roots and elicitation. So the published number for such a
 * server is a floor, and which posture the sweep runs with is a measurement
 * decision rather than a detail.
 *
 * `sampling` is deliberately absent. Declaring it says this client can ask a
 * model for a completion, and it cannot; there is no honest minimal answer to
 * `sampling/createMessage`, unlike an empty root list or a declined
 * elicitation, both of which are ordinary states a real client can be in.
 */
export interface ClientPosture {
  /** Sent verbatim as `capabilities` in `initialize`. */
  capabilities: Record<string, unknown>;
  /** Answers to server-initiated requests, by method. Every declared capability needs one. */
  answers: Record<string, unknown>;
}

/** What the sweep has always declared: nothing, and so nothing to answer. */
export const MINIMAL_POSTURE: ClientPosture = { capabilities: {}, answers: {} };

/**
 * The two capabilities this harness can answer truthfully.
 *
 * `roots/list` returns an empty list: this client exposes no filesystem roots,
 * which is a true statement about it rather than a refusal. `elicitation/create`
 * declines: the protocol provides for a user declining to answer, and an
 * unattended sweep has no user, so declining is the honest reply and not a
 * failure to implement one.
 */
export const DECLARING_POSTURE: ClientPosture = {
  capabilities: { roots: { listChanged: false }, elicitation: {} },
  answers: {
    'roots/list': { roots: [] },
    'elicitation/create': { action: 'decline' },
  },
};

export class McpStdioClient {
  private child;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private stderrChunks: string[] = [];
  private exited: Promise<void>;

  constructor(
    command: string,
    args: string[],
    env: Record<string, string | undefined>,
    /** Phrase this entry's declared status depends on — see `evidenceTail`. */
    private keepEvidence?: string,
    /**
     * Answers to server-initiated requests, one per declared capability. Empty
     * by default, which is correct only while `initialize` declares nothing.
     */
    private answers: Record<string, unknown> = {},
  ) {
    this.child = spawn(command, args, {
      env: { ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.onData(chunk));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => {
      this.stderrChunks.push(chunk);
      if (this.stderrChunks.length > 200) this.stderrChunks.shift();
    });
    // Writing to a dead pipe must not crash the sweep (EPIPE / write-after-end).
    this.child.stdin.on('error', () => {});
    this.exited = new Promise((resolve) => {
      this.child.on('error', (err) => {
        this.deadReason = `spawn failed: ${err.message}`;
        for (const p of this.pending.values()) p.reject(new Error(this.deadReason));
        this.pending.clear();
        resolve();
      });
      this.child.on('exit', (code) => {
        const tail = evidenceTail(this.stderrTail, undefined, this.keepEvidence);
        this.deadReason = `server exited (code ${code})${tail ? `; stderr tail: ${tail}` : ''}`;
        for (const p of this.pending.values()) p.reject(new Error(this.deadReason));
        this.pending.clear();
        resolve();
      });
    });
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // non-JSON noise on stdout — ignore
      }
      if (msg && typeof msg.method === 'string') {
        // Request or notification FROM the server. Ping is capability-free and
        // must be answered; anything else gets a method-not-found so the server
        // is never left hanging on an unanswered request. Server request ids may
        // collide with ours, so 'method' presence is checked before id dispatch.
        if (msg.id !== undefined && msg.id !== null) {
          if (msg.method === 'ping') this.send({ jsonrpc: '2.0', id: msg.id, result: {} });
          else if (Object.hasOwn(this.answers, msg.method))
            this.send({ jsonrpc: '2.0', id: msg.id, result: this.answers[msg.method] });
          else this.send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'method not found' } });
        }
        continue;
      }
      if (msg && typeof msg.id === 'number' && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`server error ${msg.error.code}: ${msg.error.message}`));
        else p.resolve(msg.result);
      }
    }
  }

  private send(obj: unknown) {
    this.child.stdin.write(JSON.stringify(obj) + '\n');
  }

  private deadReason: string | null = null;

  request(method: string, params: unknown, timeoutMs: number): Promise<any> {
    if (this.deadReason) return Promise.reject(new Error(this.deadReason));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // A process that is killed mid-hang never reaches the exit handler, so
        // without this a timed-out record carries no evidence at all — it says
        // only that we waited. What the server managed to print before it
        // stopped answering is usually the whole explanation.
        const tail = evidenceTail(this.stderrTail, undefined, this.keepEvidence);
        reject(
          new Error(
            `timeout after ${timeoutMs}ms waiting for ${method}${tail ? `; stderr tail: ${tail}` : ''}`,
          ),
        );
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method: string, params?: unknown) {
    this.send(params === undefined ? { jsonrpc: '2.0', method } : { jsonrpc: '2.0', method, params });
  }

  get stderrTail(): string {
    return this.stderrChunks.join('').slice(-4000);
  }

  async close() {
    this.child.stdin.end();
    const killed = setTimeout(() => this.child.kill('SIGKILL'), 2000);
    this.child.kill('SIGTERM');
    await this.exited;
    clearTimeout(killed);
  }
}

/**
 * Launch a stdio MCP server, run initialize + paginated tools/list, capture the
 * wire-order tools array. Caller owns error handling/status mapping.
 */
export async function captureTools(
  spec: string | { command: string; argv: string[] },
  opts: {
    timeoutMs?: number;
    env?: Record<string, string>;
    keepEvidence?: string;
    /**
     * What to declare at `initialize`, and how to answer what that invites.
     * Defaults to declaring nothing, which is what every published measurement
     * was taken with.
     */
    posture?: ClientPosture;
  } = {},
): Promise<WireCapture> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const posture = opts.posture ?? MINIMAL_POSTURE;
  const [cmd, ...args] = typeof spec === 'string' ? splitCommand(spec) : [spec.command, ...spec.argv];
  const client = new McpStdioClient(
    cmd,
    args,
    { PATH: process.env.PATH, HOME: process.env.HOME, ...opts.env },
    opts.keepEvidence,
    posture.answers,
  );
  try {
    const init = await client.request(
      'initialize',
      {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: posture.capabilities,
        clientInfo: { name: 'mcp-context-cost', version: '0.1.0' },
      },
      timeoutMs,
    );
    client.notify('notifications/initialized');

    const tools: unknown[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    do {
      if (++pages > 100) throw new Error('tools/list pagination exceeded 100 pages — cursor loop suspected');
      const res = await client.request('tools/list', cursor ? { cursor } : {}, timeoutMs);
      if (Array.isArray(res?.tools)) tools.push(...res.tools);
      cursor = typeof res?.nextCursor === 'string' && res.nextCursor.length > 0 ? res.nextCursor : undefined;
      if (cursor) {
        if (seenCursors.has(cursor)) throw new Error('tools/list returned a repeated cursor — pagination loop');
        seenCursors.add(cursor);
      }
    } while (cursor);

    return {
      serverInfo: init?.serverInfo,
      protocolVersion: init?.protocolVersion,
      tools,
      instructions: typeof init?.instructions === 'string' ? init.instructions : null,
      stderrTail: client.stderrTail,
    };
  } finally {
    await client.close();
  }
}

/** Shell-free command splitting: honors single/double quotes, no expansion. */
export function splitCommand(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  if (out.length === 0) throw new Error('empty command');
  return out;
}

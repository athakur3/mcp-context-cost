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
 */
export function evidenceTail(stderr: string, limit = 600): string {
  const withoutNoise = drop(stderr, (l) => /^npm (warn|notice)\b/.test(l));
  const withoutFrames = drop(withoutNoise, (l) => /^at\s/.test(l));
  return bothEnds(withoutFrames, limit);
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
function bothEnds(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const elision = '\n […] \n';
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

/** Drop matching lines, keeping the input whole if that would leave nothing. */
function drop(text: string, isNoise: (trimmedLine: string) => boolean): string {
  const kept = text
    .split('\n')
    .filter((l) => !isNoise(l.trim()))
    .join('\n')
    .trim();
  return kept || text.trim();
}

export class McpStdioClient {
  private child;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private stderrChunks: string[] = [];
  private exited: Promise<void>;

  constructor(command: string, args: string[], env: Record<string, string | undefined>) {
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
        const tail = evidenceTail(this.stderrTail);
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
        const tail = evidenceTail(this.stderrTail);
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
  opts: { timeoutMs?: number; env?: Record<string, string> } = {},
): Promise<WireCapture> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const [cmd, ...args] = typeof spec === 'string' ? splitCommand(spec) : [spec.command, ...spec.argv];
  const client = new McpStdioClient(cmd, args, {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    ...opts.env,
  });
  try {
    const init = await client.request(
      'initialize',
      {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
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

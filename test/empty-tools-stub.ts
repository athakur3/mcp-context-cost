import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A stdio MCP server that answers `initialize` and then lists no tools — the
 * shape a prompts- or resources-only server has, and also the shape every
 * server takes when a client bug drops the list. `STUB_DECLARE_TOOLS` picks
 * what `initialize` says about it: `1` declares a `tools` capability, `0`
 * declares an empty capabilities object, unset sends no capabilities at all —
 * the three cases `emptyToolsNote` in sweep/run.ts tells apart.
 */
export const EMPTY_TOOLS_STUB = `
let buf = '';
const declare = process.env.STUB_DECLARE_TOOLS;
const send = (id, body) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...body }) + '\\n');
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.method === 'initialize') {
      const result = { protocolVersion: '2025-06-18', serverInfo: { name: 'stub-empty', version: '1.0.0' } };
      if (declare === '1') result.capabilities = { tools: {} };
      else if (declare === '0') result.capabilities = {};
      send(msg.id, { result });
    } else if (msg.method === 'tools/list') send(msg.id, { result: { tools: [] } });
  }
});
process.stdin.on('end', () => process.exit(0));
`;

/** Writes the stub into `dir` and returns its path. */
export function writeEmptyToolsStub(dir: string): string {
  const path = join(dir, 'stub-empty.mjs');
  writeFileSync(path, EMPTY_TOOLS_STUB);
  return path;
}

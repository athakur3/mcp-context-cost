/**
 * The MCP revision this probe speaks, and the one place it is written down.
 *
 * Every record under `results/` was taken over a handshake that sent this
 * string. Moving it therefore re-opens the question of whether the numbers
 * either side of the move are comparable, which is why it is not a value to
 * keep current for its own sake: a newer revision published in the spec
 * repository is a reason to *read the new schema*, not by itself a reason to
 * change what we send.
 *
 * It lives in `core` because the sites that send it are in `sweep` and `audit`
 * both — the stdio probe's `initialize` params, and the remote probe's
 * JSON-RPC body and its `MCP-Protocol-Version` header, which have to agree with
 * each other and did so only by hand-typed coincidence. The stubs in `test/`
 * keep their own literals on purpose: a fixture that imported this constant
 * would agree with the probe by construction and could no longer catch it
 * drifting.
 *
 * Deliberately not exported from `core/index.ts`, alongside the other modules
 * that are reached by path — the barrel is what a library export would ship,
 * and this is the harness talking about itself.
 */
export const PROTOCOL_VERSION = '2025-06-18';

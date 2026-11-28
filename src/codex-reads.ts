import { openSync, closeSync, readSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { agentRead } from './agent-read.js';
import { dataDirectory, type UsageStore } from './usage.js';

const batchSize = 8 * 1024 * 1024;

function* transcripts(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) yield* transcripts(file);
    else if (entry.isFile() && entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) yield file;
  }
}

function inputFor(name: string, input: string) {
  try {
    if (['exec_command', 'shell_command'].includes(name)) {
      const args = JSON.parse(input);
      return { command: args.command ?? args.cmd, workdir: args.workdir };
    }
    if (name === 'exec') {
      // Codex's shell adapter can wrap a literal command in one JS tool call.
      // Read its string arguments without evaluating the JavaScript.
      const call = /^text\(await tools\.exec_command\(\{([^]*)\}\)\)\s*$/.exec(input);
      if (!call) return;
      const field = (key: string) => {
        const match = new RegExp(`(?:^|,)\\s*${key}\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(call[1]);
        return match ? JSON.parse(match[1]) as string : undefined;
      };
      return { command: field('cmd'), workdir: field('workdir') };
    }
  } catch { /* Unknown tool argument shape. */ }
}

function readBatch(path: string, offset: number): { text: string; skipped: number } {
  const fd = openSync(path, 'r');
  try {
    const bytes = Buffer.allocUnsafe(batchSize);
    const length = readSync(fd, bytes, 0, batchSize, offset);
    const complete = bytes.subarray(0, length).lastIndexOf(10);
    if (complete >= 0) return { text: bytes.subarray(0, complete + 1).toString('utf8'), skipped: 0 };
    // An oversized receipt cannot be attributed safely, but must not hide later receipts.
    for (let skipped = length; length === batchSize; skipped += batchSize) {
      const next = readSync(fd, bytes, 0, batchSize, offset + skipped);
      const end = bytes.subarray(0, next).indexOf(10);
      if (end >= 0) return { text: '', skipped: skipped + end + 1 };
      if (next < batchSize) break;
    }
    return { text: '', skipped: 0 };
  } finally { closeSync(fd); }
}

export function collectCodexReads(store: UsageStore): void {
  const home = process.env.HOME ?? '';
  let since: string;
  try { since = readFileSync(join(dataDirectory(), 'codex-reads-since'), 'utf8').trim(); } catch { return; }
  if (!Number.isFinite(Date.parse(since))) return;

  const root = join(process.env.CODEX_HOME ?? join(home, '.codex'), 'sessions');
  try {
    for (const path of transcripts(root)) {
      const session = /([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.jsonl$/i.exec(path)?.[1];
      if (!session) continue;
      const stat = statSync(path);
      if (stat.mtimeMs < Date.parse(since)) continue;
      const cursor = store.codexCursor(session);
      let offset = cursor.offset <= stat.size ? cursor.offset : 0;
      if (offset >= stat.size) continue;
      let cwd = cursor.cwd;
      const calls = new Map<string, { offset: number; command: string; workdir?: string }>();

      while (offset < stat.size) {
        const { text, skipped } = readBatch(path, offset);
        if (skipped) {
          offset += skipped;
          continue;
        }
        if (!text) break;
        for (const line of text.slice(0, -1).split('\n')) {
          const rowOffset = offset;
          offset += Buffer.byteLength(line) + 1;
          try {
            const row = JSON.parse(line);
            if (row.type === 'session_meta') cwd = row.payload?.cwd ?? '';
            if (row.type !== 'response_item' || typeof row.timestamp !== 'string' || row.timestamp < since) continue;
            const p = row.payload;
            if (!p?.call_id) continue;
            if (p.type === 'function_call' || p.type === 'custom_tool_call') {
              const input = inputFor(p.name, p.arguments ?? p.input);
              if (input?.command?.includes('SKILL.md')) calls.set(p.call_id, { offset: rowOffset, ...input, command: input.command });
            } else if (p.type === 'function_call_output' || p.type === 'custom_tool_call_output') {
              const previous = calls.get(p.call_id);
              if (!previous) continue;
              calls.delete(p.call_id);
              const event = agentRead({ hook_event_name: 'PostToolUse', session_id: session, tool_use_id: p.call_id,
                cwd, tool_name: 'Bash', tool_input: previous, tool_response: p.output }, 'codex');
              if (event) store.recordRead({ ...event, createdAt: row.timestamp });
            }
          } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
          }
        }
      }
      // Preserve a call at the tail until its output has arrived.
      for (const call of calls.values()) offset = Math.min(offset, call.offset);
      store.setCodexCursor(session, offset, cwd);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

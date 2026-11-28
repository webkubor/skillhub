import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseFrontmatter } from './scan.js';

interface HookReceipt {
  hook_event_name?: string;
  session_id?: string;
  tool_use_id?: string;
  tool_name?: string;
  cwd?: string;
  tool_input?: { file_path?: string; command?: string; workdir?: string };
  tool_response?: unknown;
}

export function sessionID(): string {
  return process.env.CS_SESSION || process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID ||
    process.env.CLAUDE_CODE_SESSION_ID || '';
}

export function agentRead(receipt: HookReceipt, agent: string) {
  if (receipt.hook_event_name !== 'PostToolUse' || !receipt.session_id || !receipt.tool_use_id) return;
  const input = receipt.tool_input;
  let file = receipt.tool_name === 'Read' ? input?.file_path : undefined;
  if (['Bash', 'exec_command', 'shell_command'].includes(receipt.tool_name ?? '') && input?.command) {
    // Only accept a standalone, literal read. Lists, compound commands and scans are ambiguous.
    const match = /^(?:cat|head|tail|rtk\s+read)\s+(?:(?:-n\s+\d+|--)\s+)*(?:"([^"\x24`\n]+)"|'([^'\n]+)'|([\w./~:@+-]+))\s*$/.exec(input.command);
    file = match?.[1] ?? match?.[2] ?? match?.[3];
  }
  if (!file || basename(file) !== 'SKILL.md') return;
  const output = typeof receipt.tool_response === 'string' ? receipt.tool_response : JSON.stringify(receipt.tool_response ?? '');
  if (/Process exited with code [1-9]|"exit_code"\s*:\s*[1-9]/.test(output.replaceAll('\\"', '"'))) return;
  const path = resolve(input?.workdir ?? receipt.cwd ?? '.', file.replace(/^~\//, (process.env.HOME ?? '') + '/'));
  let source: string;
  try {
    source = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  const { data } = parseFrontmatter(source);
  if (!data?.name) return;
  const body = source.slice(source.indexOf('\n---', 3) + 4);
  const lines = body.split('\n').map(line => line.trim()).filter(line => line.length >= 12);
  if (!lines.some(line => output.includes(line) || output.includes(JSON.stringify(line).slice(1, -1)))) return;
  return { skill: data.name, agent, session: receipt.session_id, source: 'agent-tool',
    eventKey: JSON.stringify([agent, receipt.session_id, receipt.tool_use_id]) };
}

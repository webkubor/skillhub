import { readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const launcher = process.argv[2] ?? join(homedir(), '.local', 'bin', 'skillhub');
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
for (const [agent, file, matcher] of [
  ['codex', join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'hooks.json'), '.*'],
  ['claude', join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'settings.json'), 'Read|Bash'],
]) {
  let original = '';
  let mode = 0o600;
  try {
    original = readFileSync(file, 'utf8');
    mode = statSync(file).mode & 0o777;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const config = original ? JSON.parse(original) : {};
  config.hooks ??= {};
  const hooks = config.hooks.PostToolUse ??= [];
  const command = quote(launcher) + ' _hook ' + agent;
  if (hooks.some(group => group.hooks.some(hook => hook.command === command))) continue;
  hooks.push({ matcher, hooks: [{ type: 'command', command, timeout: 5 }] });
  mkdirSync(dirname(file), { recursive: true });
  const staged = file + '.' + randomUUID() + '.tmp';
  writeFileSync(staged, JSON.stringify(config, null, 2) + '\n', { mode, flag: 'wx' });
  renameSync(staged, file);
  console.log(agent + ': PostToolUse 已注册');
}

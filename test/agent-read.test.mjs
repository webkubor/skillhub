import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { agentRead } from '../dist/agent-read.js';
import { UsageStore } from '../dist/usage.js';

test('successful skill-body receipt is deduplicated and kept out of execution stats', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillhub-read-'));
  const file = join(root, 'SKILL.md');
  const body = 'Follow the instructions in this body.';
  writeFileSync(file, '---\nname: demo\n---\n' + body);
  const hook = {
    hook_event_name: 'PostToolUse', session_id: 's1', tool_use_id: 't1',
    tool_name: 'exec_command', tool_input: { command: 'cat ' + file }, tool_response: body,
  };
  const event = agentRead(hook, 'codex');
  assert.equal(event.skill, 'demo');
  assert.equal(agentRead({ ...hook, tool_input: { command: 'ls ' + file } }, 'codex'), undefined);
  assert.equal(agentRead({ ...hook, tool_response: 'name: demo' }, 'codex'), undefined);
  assert.equal(agentRead({ ...hook, tool_response: 'Process exited with code 1\n' + body }, 'codex'), undefined);
  const store = new UsageStore(join(root, 'usage.sqlite'));
  try {
    store.recordRead(event);
    store.recordRead(event);
    assert.equal(store.reads('demo', 's1').length, 1);
    assert.deepEqual(store.stats(), []);
  } finally { store.close(); }
});

test('run records the command exit status separately and scanning generates no events', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillhub-run-'));
  const env = { ...process.env, SKILLHUB_DATA_DIR: root, CS_SESSION: 'real-exit' };
  const run = (...args) => spawnSync(process.execPath, ['dist/cli.js', ...args], { env, encoding: 'utf8' });
  assert.equal(run('scan', '--root', root).status, 0);
  assert.deepEqual(JSON.parse(run('reads', '--json').stdout), []);
  assert.deepEqual(JSON.parse(run('stats', '--json').stdout), []);
  assert.equal(run('run', 'demo', '--', process.execPath, '-e', 'process.exit(17)').status, 17);
  const [stats] = JSON.parse(run('stats', '--json').stdout);
  assert.equal(stats.failed, 1);
  assert.equal(stats.success, 0);
  assert.deepEqual(JSON.parse(run('reads', '--json').stdout), []);
});

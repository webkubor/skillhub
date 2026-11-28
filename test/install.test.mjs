import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('installer restores locked dependencies and verifies startup before publishing the launcher', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillhub install '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  const env = { ...process.env, HOME: root, SKILLHUB_INSTALL_DIR: bin, CORTEXOS_DIR: root,
    SKILLHUB_SKIP_CS_REGISTER: '0', npm_config_offline: 'true', npm_config_cache: join(root, 'cache') };
  const run = (cmd, args) => spawnSync(cmd, args, { cwd: repo, env, encoding: 'utf8' });
  const ok = result => assert.equal(result.status, 0, result.stderr);
  for (const dir of ['dist', 'fixture', 'integrations/cs']) mkdirSync(join(repo, dir), { recursive: true });
  copyFileSync(new URL('../install.sh', import.meta.url), join(repo, 'install.sh'));
  writeFileSync(join(repo, 'package.json'), JSON.stringify({
    name: 'install-test', type: 'module', dependencies: { 'fixture-lib': 'file:./fixture' }
  }));
  writeFileSync(join(repo, 'fixture/package.json'), JSON.stringify({ name: 'fixture-lib', version: '1.0.0', main: 'index.js' }));
  writeFileSync(join(repo, 'fixture/index.js'), '');
  writeFileSync(join(repo, 'dist/cli.js'), "import 'fixture-lib';\n");
  ok(run('npm', ['install', '--package-lock-only']));
  assert.equal(existsSync(join(repo, 'node_modules')), false);

  const install = () => run('bash', ['install.sh']);
  ok(install());
  ok(run(join(bin, 'skillhub'), ['--help']));
  const marker = join(repo, 'node_modules/keep');
  writeFileSync(marker, '');
  ok(install());
  assert.ok(existsSync(marker), 'healthy dependencies must not be reinstalled');

  const launcher = join(bin, 'skillhub');
  const registry = join(root, 'var/skill-roots.txt');
  writeFileSync(launcher, 'existing launcher');
  rmSync(registry);
  writeFileSync(join(repo, 'dist/cli.js'), 'process.exit(42);');
  const failed = install();
  assert.equal(failed.status, 42, failed.stderr);
  assert.doesNotMatch(failed.stdout, /installed:/);
  assert.equal(readFileSync(launcher, 'utf8'), 'existing launcher');
  assert.equal(existsSync(registry), false);
});

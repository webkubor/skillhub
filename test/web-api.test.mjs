import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../dist/web.js';
import { UsageStore } from '../dist/usage.js';

function createFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-web-test-'));
  const skillDir = join(dir, 'skills', 'demo-skill');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---
name: demo-skill
description: A demo skill for Hono API tests
version: 1.2.0
origin: personal:demo
category: testing
---

# Demo Skill
Hello from SKILL.md
`,
    'utf8',
  );
  const store = new UsageStore(join(dir, 'usage.sqlite'));
  store.record({ skill: 'demo-skill', outcome: 'success', agent: 'claude' });
  store.record({ skill: 'demo-skill', outcome: 'failed', agent: 'codex', problem: 'timeout' });
  return { dir, roots: [join(dir, 'skills')], store };
}

test('Hono API: /api/overview returns merged skills and summary', async () => {
  const { dir, roots, store } = createFixture();
  try {
    const app = await createApp(roots, store);
    const res = await app.request('/api/overview');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.summary.totalSkills, 1);
    assert.equal(data.summary.totalUses, 2);
    assert.equal(data.skills[0].name, 'demo-skill');
    assert.equal(data.skills[0].version, '1.2.0');
    assert.equal(data.skills[0].visibility, 'closed');
    assert.equal(data.problems.length, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Hono API: POST /api/visibility and /api/lifecycle validate with Zod and persist', async () => {
  const { dir, roots, store } = createFixture();
  try {
    const app = await createApp(roots, store);

    const badVis = await app.request('/api/visibility', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skill: 'demo-skill', status: 'public' }),
    });
    assert.equal(badVis.status, 400);

    const okVis = await app.request('/api/visibility', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skill: 'demo-skill', status: 'open', note: 'test' }),
    });
    assert.equal(okVis.status, 200);

    const badLc = await app.request('/api/lifecycle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skill: 'demo-skill', status: 'deleted' }),
    });
    assert.equal(badLc.status, 400);

    const okLc = await app.request('/api/lifecycle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skill: 'demo-skill', status: 'deprecated' }),
    });
    assert.equal(okLc.status, 200);

    const overview = await (await app.request('/api/overview')).json();
    assert.equal(overview.skills[0].visibility, 'open');
    assert.equal(overview.skills[0].visibility_source, 'explicit');
    assert.equal(overview.skills[0].lifecycle, 'deprecated');
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Hono API: /api/skills/:name/source, /history, /diff handle valid and invalid inputs', async () => {
  const { dir, roots, store } = createFixture();
  try {
    const app = await createApp(roots, store);

    const srcRes = await app.request('/api/skills/demo-skill/source');
    assert.equal(srcRes.status, 200);
    const src = await srcRes.json();
    assert.match(src.content, /Hello from SKILL\.md/);

    const notFound = await app.request('/api/skills/missing-skill/source');
    assert.equal(notFound.status, 404);

    const histRes = await app.request('/api/skills/demo-skill/history');
    assert.equal(histRes.status, 200);
    const hist = await histRes.json();
    assert.ok(Array.isArray(hist.commits));

    const badDiff = await app.request('/api/skills/demo-skill/diff?from=invalid;rm');
    assert.equal(badDiff.status, 400);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

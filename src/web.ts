import { readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { auditSkills } from './audit.js';
import { checkCliStatus } from './cli-status.js';
import { getSkillGitDiff, getSkillGitHistory, isValidCommitRef } from './git-history.js';
import { buildProfiles } from './profile.js';
import { buildRelations, currentGithubAccount, publicRepos } from './relations.js';
import { doctor, scanSkills } from './scan.js';
import { DEFAULT_ALLOWED_DUPLICATES, DEFAULT_EXCLUDES } from './roots.js';
import type { AllowedDuplicate, ScanResult } from './types.js';
import { UsageStore } from './usage.js';

const VisibilitySchema = z.object({
  skill: z.string().min(1),
  status: z.enum(['open', 'closed']),
  note: z.string().optional().default(''),
});

const LifecycleSchema = z.object({
  skill: z.string().min(1),
  status: z.enum(['draft', 'active', 'deprecated', 'archived']),
  note: z.string().optional().default(''),
});

const ControlSchema = z.object({
  action: z.enum(['refresh', 'tab', 'focus', 'theme', 'filter', 'toast']),
  tab: z.enum(['skills', 'analytics', 'relations', 'doctor']).optional(),
  skill: z.string().optional(),
  theme: z.enum(['dark', 'light']).optional(),
  query: z.string().optional(),
  visibility: z.enum(['all', 'open', 'closed']).optional(),
  message: z.string().optional(),
});

export type ControlEvent = z.infer<typeof ControlSchema>;

export async function createApp(
  roots: string[],
  usage?: UsageStore,
  excludePrefixes: string[] = DEFAULT_EXCLUDES,
  allowedDuplicates: AllowedDuplicate[] = DEFAULT_ALLOWED_DUPLICATES,
) {
  let cached: ScanResult = await scanSkills({ roots, excludePrefixes, allowedDuplicates });
  const store = usage ?? new UsageStore();
  const account = await currentGithubAccount();
  const pub = account ? await publicRepos(account) : null;
  let relations = await buildRelations(cached.skills, account ?? '', pub ?? undefined);
  let refreshedAt = new Date().toISOString();

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const webOutDir = resolve(packageRoot, 'web', 'out');
  const staticRoot = relative(process.cwd(), webOutDir) || '.';

  // Active SSE subscribers for CLI -> Web real-time control
  const subscribers = new Set<(event: ControlEvent) => void>();
  const broadcast = (event: ControlEvent) => {
    for (const send of subscribers) {
      try {
        send(event);
      } catch {
        subscribers.delete(send);
      }
    }
    return subscribers.size;
  };

  const app = new Hono();

  function buildOverview() {
    const profiles = buildProfiles(cached.skills, store);
    const profileMap = new Map(profiles.map((p) => [p.name, p]));
    const relationMap = new Map(relations.map((r) => [r.skill, r]));
    const doctorReport = doctor(cached);
    const cliStatus = checkCliStatus();
    const stats = store.stats();
    const agents = store.agents();
    const problems = store.problems();

    const skills = cached.skills.map((s) => {
      const p = profileMap.get(s.name);
      const r = relationMap.get(s.name);
      return {
        name: s.name,
        description: s.description,
        version: s.version,
        scope: s.scope,
        origin: s.origin,
        category: s.category,
        path: s.path,
        publish: s.publish,
        lifecycle: p?.lifecycle ?? 'active',
        lifecycle_note: p?.lifecycle_note ?? '',
        visibility: p?.visibility ?? (s.origin.startsWith('opensource:') ? 'open' : 'closed'),
        visibility_note: p?.visibility_note ?? '',
        visibility_source: p?.visibility_source ?? 'inferred',
        total_uses: p?.total_uses ?? 0,
        success_rate: p?.success_rate ?? 0,
        uses_7d: p?.uses_7d ?? 0,
        uses_30d: p?.uses_30d ?? 0,
        agents: p?.agents ?? [],
        unique_agents: p?.unique_agents ?? 0,
        last_used_at: p?.last_used_at ?? '',
        relation: r?.relation ?? 'unlinked',
        repo: r?.repo ?? null,
        via: r?.via ?? null,
      };
    });

    const auditReport = auditSkills(skills, cached.duplicates);
    const totalUses = stats.reduce((sum, r) => sum + r.uses, 0);
    const totalSuccess = stats.reduce((sum, r) => sum + r.success, 0);
    const uses7d = skills.reduce((sum, s) => sum + s.uses_7d, 0);
    const uses30d = skills.reduce((sum, s) => sum + s.uses_30d, 0);

    const summary = {
      totalSkills: skills.length,
      activeSkills: skills.filter((s) => s.lifecycle === 'active').length,
      archivedSkills: skills.filter((s) => s.lifecycle === 'archived').length,
      brokenCount: cached.broken.length,
      doctorOk: doctorReport.ok,
      doctorProblemsCount: doctorReport.problems.length,
      auditOk: auditReport.ok,
      auditErrorCount: auditReport.errorCount,
      auditWarnCount: auditReport.warnCount,
      openCount: skills.filter((s) => s.visibility === 'open').length,
      closedCount: skills.filter((s) => s.visibility === 'closed').length,
      totalUses,
      uses7d,
      uses30d,
      overallSuccessRate: totalUses ? totalSuccess / totalUses : 0,
      ownPublicCount: skills.filter((s) => s.relation === 'own-public').length,
      ownPrivateCount: skills.filter((s) => s.relation === 'own-private').length,
      thirdPartyCount: skills.filter((s) => s.relation === 'third-party').length,
      unlinkedCount: skills.filter((s) => s.relation === 'unlinked').length,
    };

    return {
      summary,
      account: account ?? null,
      cliStatus,
      doctor: doctorReport,
      audit: auditReport,
      skills,
      relations,
      stats,
      agents,
      problems,
      broken: cached.broken,
      duplicates: cached.duplicates,
      scannedRoots: cached.scannedRoots,
      refreshedAt,
    };
  }

  const handleRefresh = async () => {
    cached = await scanSkills({ roots, excludePrefixes, allowedDuplicates });
    relations = await buildRelations(cached.skills, account ?? '', pub ?? undefined);
    checkCliStatus(true);
    refreshedAt = new Date().toISOString();
    return { ok: true, count: cached.count, refreshedAt };
  };

  app.get('/api/overview', (c) => c.json(buildOverview()));
  app.get('/api/audit', (c) => c.json(buildOverview().audit));
  app.get('/api/scan', (c) => c.json(cached));
  app.get('/api/doctor', (c) => c.json(doctor(cached)));
  app.get('/api/stats', (c) => c.json(store.stats()));
  app.get('/api/status', (c) => c.json(checkCliStatus()));
  app.get('/api/relations', (c) => c.json({ account, relations }));
  app.get('/api/profiles', (c) => c.json(buildProfiles(cached.skills, store)));

  app.get('/api/events', (c) => {
    return streamSSE(c, async (stream) => {
      const send = (event: ControlEvent) => {
        void stream.writeSSE({ event: 'control', data: JSON.stringify(event) });
      };
      subscribers.add(send);
      await stream.writeSSE({ event: 'ready', data: JSON.stringify({ connected: true, at: new Date().toISOString() }) });

      const timer = setInterval(() => {
        void stream.writeSSE({ event: 'ping', data: String(Date.now()) }).catch(() => {
          clearInterval(timer);
          subscribers.delete(send);
        });
      }, 25_000);

      stream.onAbort(() => {
        clearInterval(timer);
        subscribers.delete(send);
      });

      await new Promise<void>((resolveAbort) => {
        stream.onAbort(() => resolveAbort());
      });
    });
  });

  app.post('/api/control', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = ControlSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid control payload', issues: parsed.error.issues }, 400);
    }
    if (parsed.data.action === 'refresh') {
      await handleRefresh();
    }
    const clients = broadcast(parsed.data);
    return c.json({ ok: true, clients, event: parsed.data });
  });

  app.get('/api/skills/:name/source', (c) => {
    const name = decodeURIComponent(c.req.param('name'));
    const skill = cached.skills.find((s) => s.name === name);
    if (!skill) return c.json({ error: `Skill not found: ${name}` }, 404);
    try {
      const stat = statSync(skill.path);
      const raw = readFileSync(skill.path, 'utf8');
      const content = raw.length > 65536 ? `${raw.slice(0, 65536)}\n\n... (truncated)` : raw;
      return c.json({ name: skill.name, path: skill.path, content, updatedAt: stat.mtime.toISOString(), sizeBytes: stat.size });
    } catch (err) {
      return c.json({ name: skill.name, path: skill.path, content: `Failed to read: ${String(err)}` });
    }
  });

  app.get('/api/skills/:name/history', (c) => {
    const name = decodeURIComponent(c.req.param('name'));
    const skill = cached.skills.find((s) => s.name === name);
    if (!skill) return c.json({ error: `Skill not found: ${name}` }, 404);
    const commits = getSkillGitHistory(skill.path, 12);
    return c.json({ name: skill.name, path: skill.path, commits });
  });

  app.get('/api/skills/:name/diff', (c) => {
    const name = decodeURIComponent(c.req.param('name'));
    const skill = cached.skills.find((s) => s.name === name);
    if (!skill) return c.json({ error: `Skill not found: ${name}` }, 404);
    const from = c.req.query('from') ?? '';
    const to = c.req.query('to') || undefined;
    if (!from || !isValidCommitRef(from) || (to && !isValidCommitRef(to))) {
      return c.json({ error: 'Invalid commit reference' }, 400);
    }
    const diff = getSkillGitDiff(skill.path, from, to);
    return c.json({ name: skill.name, from, to: to ?? null, diff });
  });

  app.post('/api/visibility', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = VisibilitySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400);
    const row = store.setVisibility(parsed.data.skill, parsed.data.status, parsed.data.note);
    broadcast({ action: 'refresh', message: `${parsed.data.skill} → ${parsed.data.status}` });
    return c.json(row);
  });

  app.post('/api/lifecycle', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = LifecycleSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400);
    const row = store.setLifecycle(parsed.data.skill, parsed.data.status, parsed.data.note);
    broadcast({ action: 'refresh', message: `${parsed.data.skill} → ${parsed.data.status}` });
    return c.json(row);
  });

  app.post('/api/refresh', async (c) => {
    const out = await handleRefresh();
    broadcast({ action: 'refresh' });
    return c.json(out);
  });
  app.get('/api/refresh', async (c) => c.json(await handleRefresh()));

  app.use('/*', serveStatic({ root: staticRoot }));
  app.get('*', serveStatic({ path: `${staticRoot}/index.html` }));

  app.onError((err, c) => c.json({ error: err.message || 'Internal Server Error' }, 500));

  return app;
}

export async function createHandler(
  roots: string[],
  usage?: UsageStore,
  excludePrefixes: string[] = DEFAULT_EXCLUDES,
  allowedDuplicates: AllowedDuplicate[] = DEFAULT_ALLOWED_DUPLICATES,
): Promise<(req: IncomingMessage, res: ServerResponse) => void> {
  const app = await createApp(roots, usage, excludePrefixes, allowedDuplicates);
  return getRequestListener(app.fetch);
}

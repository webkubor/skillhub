import type { SkillRecord } from './types.js';
import { UsageStore, type LifecycleStatus } from './usage.js';

export interface SkillProfile {
  name: string;
  version: string | null;
  lifecycle: LifecycleStatus;        // 未登记默认 active
  lifecycle_note: string;
  total_uses: number;
  success_rate: number;
  uses_7d: number;
  uses_30d: number;
  agents: Array<{ agent: string; uses: number }>;
  unique_agents: number;
  last_used_at: string;
  path: string;
}

export function buildProfiles(skills: SkillRecord[], store: UsageStore): SkillProfile[] {
  const stats = new Map(store.stats().map(r => [r.skill, r]));
  const freq7 = new Map(store.frequency(7).map(r => [r.skill, r.uses]));
  const freq30 = new Map(store.frequency(30).map(r => [r.skill, r.uses]));
  const agents = new Map<string, Array<{ agent: string; uses: number }>>();
  for (const a of store.agents()) {
    const list = agents.get(a.skill) ?? [];
    list.push({ agent: a.agent, uses: a.uses });
    agents.set(a.skill, list);
  }
  const lifecycle = new Map(store.lifecycle().map(r => [r.skill, r]));

  return skills.map((s) => {
    const st = stats.get(s.name);
    const lc = lifecycle.get(s.name);
    const ag = agents.get(s.name) ?? [];
    return {
      name: s.name,
      version: s.version,
      lifecycle: lc?.status ?? 'active',
      lifecycle_note: lc?.note ?? '',
      total_uses: st?.uses ?? 0,
      success_rate: st?.success_rate ?? 0,
      uses_7d: freq7.get(s.name) ?? 0,
      uses_30d: freq30.get(s.name) ?? 0,
      agents: ag.sort((a, b) => b.uses - a.uses),
      unique_agents: ag.length,
      last_used_at: st?.last_used_at ?? '',
      path: s.path,
    };
  });
}

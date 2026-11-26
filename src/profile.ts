import type { SkillRecord } from './types.js';
import { UsageStore, type LifecycleStatus, type VisibilityStatus } from './usage.js';

export interface SkillProfile {
  name: string;
  version: string | null;
  lifecycle: LifecycleStatus;        // 未登记默认 active
  lifecycle_note: string;
  visibility: VisibilityStatus;      // 未登记时由 origin 推断
  visibility_note: string;
  visibility_source: 'explicit' | 'inferred';
  total_uses: number;
  success_rate: number;
  uses_7d: number;
  uses_30d: number;
  agents: Array<{ agent: string; uses: number }>;
  unique_agents: number;
  last_used_at: string;
  path: string;
}

/** 公开 GitHub 仓库不等于开源许可证；默认只认 frontmatter 明确声明的 opensource。 */
function inferVisibility(skill: SkillRecord): VisibilityStatus {
  return skill.origin.startsWith('opensource:') ? 'open' : 'closed';
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
  const visibility = new Map(store.visibility().map(r => [r.skill, r]));

  return skills.map((s) => {
    const st = stats.get(s.name);
    const lc = lifecycle.get(s.name);
    const vis = visibility.get(s.name);
    const ag = agents.get(s.name) ?? [];
    return {
      name: s.name,
      version: s.version,
      lifecycle: lc?.status ?? 'active',
      lifecycle_note: lc?.note ?? '',
      visibility: vis?.status ?? inferVisibility(s),
      visibility_note: vis?.note ?? '',
      visibility_source: vis ? 'explicit' : 'inferred',
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

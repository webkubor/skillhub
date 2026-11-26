'use client';

import { Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AgentStatRow, ProblemRow, SkillItem, StatsRow } from '@/lib/types';
import { formatPercent, formatShortTime } from '@/lib/utils';
import { AgentBadge } from './ui/agent-badge';
import { Badge, Button, Card } from './ui/primitives';

export function AnalyticsView({
  skills,
  stats,
  agents,
  problems,
}: {
  skills: SkillItem[];
  stats: StatsRow[];
  agents: AgentStatRow[];
  problems: ProblemRow[];
}) {
  const [copied, setCopied] = useState(false);

  const topSkills = useMemo(
    () =>
      [...skills]
        .filter((s) => s.total_uses > 0)
        .sort((a, b) => b.total_uses - a.total_uses)
        .slice(0, 12)
        .map((s) => ({
          name: s.name.length > 22 ? `${s.name.slice(0, 20)}…` : s.name,
          fullName: s.name,
          total: s.total_uses,
          uses7d: s.uses_7d,
          uses30d: s.uses_30d,
        })),
    [skills],
  );

  const agentTotals = useMemo(() => {
    const map = new Map<string, { agent: string; uses: number; success: number; failed: number }>();
    for (const row of agents) {
      const key = row.agent || '(unknown)';
      const curr = map.get(key) ?? { agent: key, uses: 0, success: 0, failed: 0 };
      curr.uses += row.uses;
      curr.success += row.success;
      curr.failed += row.failed + row.partial;
      map.set(key, curr);
    }
    return [...map.values()].sort((a, b) => b.uses - a.uses).slice(0, 10);
  }, [agents]);

  if (stats.length === 0) {
    const sampleSkill = skills[0]?.name ?? 'skillhub';
    const sampleCmd = `skillhub use ${sampleSkill} --outcome success --agent claude`;
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto flex max-w-lg flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2">
            {['claude', 'codex', 'gemini', 'cursor', 'dsh'].map((a) => (
              <AgentBadge key={a} agent={a} compact />
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--fg)]">暂无调用遥测数据</p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--fg-muted)]">
            在任意 Agent 完成 Skill 调用后执行下面一行命令，此处将自动展示高频排行、Agent 图标分布与成功率趋势。
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <code className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 font-mono text-xs text-[var(--info)]">
              {sampleCmd}
            </code>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(sampleCmd);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                } catch {
                  // ignore
                }
              }}
            >
              {copied ? <Check className="h-3 w-3 text-[var(--ok)]" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? '已复制' : '复制测试命令'}</span>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Agent Brand Strip */}
      {agentTotals.length > 0 && (
        <Card className="flex flex-wrap items-center gap-2.5 p-3.5">
          <span className="text-xs font-medium text-[var(--fg-muted)]">活跃调用方 Agent：</span>
          {agentTotals.map((a) => (
            <AgentBadge key={a.agent} agent={a.agent} count={a.uses} />
          ))}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Top Skills Bar Chart */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--fg)]">高频 Skill 调用排行</h3>
              <p className="mt-0.5 text-xs text-[var(--fg-muted)]">按累计调用与近 7 天调用对比</p>
            </div>
            <Badge tone="info">Top {topSkills.length}</Badge>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSkills} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={132}
                  tick={{ fill: 'var(--fg-secondary)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }}
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--fg)',
                  }}
                />
                <Bar dataKey="total" name="累计调用" fill="var(--info)" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="uses7d" name="近 7 天" fill="var(--ok)" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Agent Distribution Chart */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--fg)]">Agent 调用分布</h3>
              <p className="mt-0.5 text-xs text-[var(--fg-muted)]">按调用方聚合成功与异常次数</p>
            </div>
            <Badge tone="neutral">{agentTotals.length} Agents</Badge>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentTotals} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="agent" tick={{ fill: 'var(--fg-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }}
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--fg)',
                  }}
                />
                <Bar dataKey="success" name="成功" stackId="a" fill="var(--ok)" radius={[0, 0, 0, 0]} barSize={28} />
                <Bar dataKey="failed" name="部分/失败" stackId="a" fill="var(--warn)" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Stats Detail Table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h3 className="text-sm font-semibold text-[var(--fg)]">调用明细</h3>
          <span className="text-xs text-[var(--fg-muted)] tabular-nums">{stats.length} 个有记录的 Skill</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-medium text-[var(--fg-muted)]">
                <th className="px-4 py-2.5">Skill</th>
                <th className="px-4 py-2.5 text-right">总调用</th>
                <th className="px-4 py-2.5 text-right">成功</th>
                <th className="px-4 py-2.5 text-right">部分</th>
                <th className="px-4 py-2.5 text-right">失败</th>
                <th className="px-4 py-2.5 text-right">成功率</th>
                <th className="px-4 py-2.5 text-right">最近调用</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {stats.map((r) => (
                <tr key={r.skill} className="hover:bg-[var(--surface-hover)]/60">
                  <td className="px-4 py-2.5 font-mono font-medium text-[var(--fg)]">{r.skill}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{r.uses}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--ok)]">{r.success}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--warn)]">{r.partial}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--danger)]">{r.failed}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    <span className={r.success_rate >= 0.8 ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}>
                      {formatPercent(r.success_rate)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--fg-muted)]">
                    {formatShortTime(r.last_used_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Problems Log */}
      {problems.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
            <h3 className="text-sm font-semibold text-[var(--fg)]">异常与失败记录</h3>
            <Badge tone="warn">{problems.length} 条</Badge>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {problems.slice(0, 20).map((p) => (
              <div key={p.id} className="flex flex-col gap-1.5 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={p.outcome === 'failed' ? 'danger' : 'warn'}>{p.outcome}</Badge>
                  <span className="font-mono font-medium text-[var(--fg)]">{p.skill}</span>
                  <span className="text-[var(--fg-secondary)]">{p.problem}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--fg-muted)]">
                  {p.agent && <AgentBadge agent={p.agent} compact />}
                  <span>{formatShortTime(p.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

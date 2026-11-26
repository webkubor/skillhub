'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileCode2,
  FolderOpen,
  GitCommitHorizontal,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchSkillDiff, fetchSkillHistory, fetchSkillSource } from '@/lib/api';
import type { AuditFinding, SkillItem } from '@/lib/types';
import { cn, formatPercent, formatShortTime } from '@/lib/utils';
import { AgentBadge } from './ui/agent-badge';
import { Badge, Button, Drawer, DrawerContent, StatusDot, Tabs, TabsContent, TabsList, TabsTrigger } from './ui/primitives';

function DiffViewer({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return (
      <div className="p-4 text-xs text-[var(--fg-muted)]">
        该提交无正文差异（或非文本变更）。
      </div>
    );
  }
  const lines = diff.split('\n');
  return (
    <pre className="max-h-[380px] overflow-auto font-mono text-[11.5px] leading-relaxed">
      {lines.map((line, i) => {
        const isAdd = line.startsWith('+') && !line.startsWith('+++');
        const isDel = line.startsWith('-') && !line.startsWith('---');
        const isHunk = line.startsWith('@@');
        const isMeta =
          line.startsWith('diff ') ||
          line.startsWith('index ') ||
          line.startsWith('---') ||
          line.startsWith('+++');
        return (
          <div
            key={i}
            className={cn(
              'px-3.5 py-0.5 whitespace-pre-wrap break-words',
              isAdd && 'bg-[var(--ok-soft)] text-[var(--ok)]',
              isDel && 'bg-[var(--danger-soft)] text-[var(--danger)]',
              isHunk && 'bg-[var(--info-soft)] text-[var(--info)]',
              isMeta && 'text-[var(--fg-muted)]',
              !isAdd && !isDel && !isHunk && !isMeta && 'text-[var(--fg-secondary)]',
            )}
          >
            {line || ' '}
          </div>
        );
      })}
    </pre>
  );
}

export function SkillDrawer({
  skill,
  findings = [],
  open,
  onOpenChange,
}: {
  skill: SkillItem | null;
  findings?: AuditFinding[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [innerTab, setInnerTab] = useState<'source' | 'diff'>('source');
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setInnerTab('source');
    setSelectedCommit(null);
    setCopiedKey(null);
  }, [skill?.name]);

  const { data: source, isLoading: loadingSource } = useQuery({
    queryKey: ['skill-source', skill?.name],
    queryFn: () => fetchSkillSource(skill!.name),
    enabled: open && !!skill?.name,
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['skill-history', skill?.name],
    queryFn: () => fetchSkillHistory(skill!.name),
    enabled: open && !!skill?.name && innerTab === 'diff',
  });

  const activeHash = selectedCommit ?? history?.commits?.[0]?.hash ?? null;

  const { data: diffData, isLoading: loadingDiff } = useQuery({
    queryKey: ['skill-diff', skill?.name, activeHash],
    queryFn: () => fetchSkillDiff(skill!.name, activeHash!),
    enabled: open && !!skill?.name && innerTab === 'diff' && !!activeHash,
  });

  if (!skill) return null;

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const telemetryCmd = `skillhub use ${skill.name} --outcome success --agent claude`;
  const aiOptimizePrompt = findings.length
    ? `请帮我修复本地 Skill「${skill.name}」（路径：${skill.path}）的以下审计问题：\n${findings
        .map((f) => `- [${f.severity}] ${f.message}（建议：${f.suggestion}）`)
        .join('\n')}\n修复后请运行 skillhub doctor 验证。`
    : `请审阅本地 Skill「${skill.name}」（路径：${skill.path}）的 SKILL.md，优化触发描述与边界约束，保持精简可读。`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent title={skill.name} description={skill.description || '暂无描述'}>
        <div className="space-y-5">
          {/* 元数据网格 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="text-[11px] text-[var(--fg-muted)]">版本</div>
              <div className="mt-1 font-mono text-sm font-medium text-[var(--fg)]">
                {skill.version ? `v${skill.version.replace(/^v/, '')}` : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="text-[11px] text-[var(--fg-muted)]">近 7d / 总调用</div>
              <div className="mt-1 font-mono text-sm font-medium tabular-nums text-[var(--fg)]">
                {skill.uses_7d} <span className="text-[var(--fg-muted)]">/ {skill.total_uses}</span>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="text-[11px] text-[var(--fg-muted)]">成功率</div>
              <div className="mt-1 font-mono text-sm font-medium tabular-nums text-[var(--fg)]">
                {skill.total_uses > 0 ? formatPercent(skill.success_rate) : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="text-[11px] text-[var(--fg-muted)]">来源口径</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-medium">
                <StatusDot tone={skill.visibility === 'open' ? 'ok' : 'warn'} />
                <span>{skill.visibility === 'open' ? '开源' : '闭源'}</span>
                <span className="text-[10px] text-[var(--fg-muted)]">
                  ({skill.visibility_source === 'explicit' ? '标注' : '推断'})
                </span>
              </div>
            </div>
          </div>

          {/* 审计告警（如有） */}
          {findings.length > 0 && (
            <div className="space-y-2 rounded-lg border border-[color-mix(in_oklch,var(--warn)_35%,var(--border))] bg-[var(--warn-soft)]/60 p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--warn)]">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>审计提醒（{findings.length}）</span>
              </div>
              <ul className="space-y-1.5 text-xs">
                {findings.map((f, idx) => (
                  <li key={idx} className="leading-relaxed text-[var(--fg-secondary)]">
                    <Badge tone={f.severity === 'error' ? 'danger' : 'warn'} className="mr-1.5">
                      {f.severity === 'error' ? '阻断' : '建议'}
                    </Badge>
                    <span>{f.message}</span>
                    <span className="text-[var(--fg-muted)]"> — {f.suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI 自动化快捷操作 */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--fg-secondary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--info)]" />
              <span>AI 自动化快捷指令</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="default" size="sm" onClick={() => copyText('prompt', aiOptimizePrompt)}>
                {copiedKey === 'prompt' ? <Check className="h-3 w-3 text-[var(--ok)]" /> : <Copy className="h-3 w-3" />}
                <span>{copiedKey === 'prompt' ? '已复制 Prompt' : findings.length ? '复制 AI 修复 Prompt' : '复制 AI 优化 Prompt'}</span>
              </Button>
              <Button variant="subtle" size="sm" onClick={() => copyText('use', telemetryCmd)}>
                {copiedKey === 'use' ? <Check className="h-3 w-3 text-[var(--ok)]" /> : <Copy className="h-3 w-3" />}
                <span>{copiedKey === 'use' ? '已复制命令' : '复制遥测打点命令'}</span>
              </Button>
            </div>
          </div>

          {/* 路径与仓库 */}
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 text-xs">
            <div className="flex items-start gap-2">
              <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--fg-muted)]" />
              <div className="min-w-0 flex-1">
                <span className="text-[var(--fg-muted)]">本地路径：</span>
                <code className="break-all text-[var(--fg-secondary)]">{skill.path}</code>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge tone="neutral">{skill.category || 'uncategorized'}</Badge>
              <Badge tone="info">{skill.origin}</Badge>
              {skill.scope && <Badge tone="accent">scope: {skill.scope}</Badge>}
              {skill.repo && (
                <a
                  href={skill.repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--info)] hover:underline"
                >
                  {skill.repo.owner}/{skill.repo.repo}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Agent 调用分布 */}
          {skill.agents.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--fg-secondary)]">
                <Bot className="h-3.5 w-3.5 text-[var(--fg-muted)]" />
                <span>调用方 Agent 分布</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {skill.agents.map((a) => (
                  <AgentBadge key={a.agent} agent={a.agent || 'unknown'} count={a.uses} />
                ))}
              </div>
            </div>
          )}

          {/* 源码预览 vs 版本历史 Diff */}
          <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as 'source' | 'diff')} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="source">
                  <FileCode2 className="h-3.5 w-3.5" />
                  <span>SKILL.md 源码</span>
                </TabsTrigger>
                <TabsTrigger value="diff">
                  <GitCommitHorizontal className="h-3.5 w-3.5" />
                  <span>版本历史 / Diff</span>
                </TabsTrigger>
              </TabsList>

              {innerTab === 'source' && source?.updatedAt && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--fg-muted)]">
                  <Clock className="h-3 w-3" />
                  {formatShortTime(source.updatedAt)}
                  {source.sizeBytes ? ` · ${(source.sizeBytes / 1024).toFixed(1)} KB` : ''}
                </span>
              )}
            </div>

            <TabsContent value="source" className="focus:outline-none">
              <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                {loadingSource ? (
                  <div className="p-4 text-xs text-[var(--fg-muted)]">正在读取 SKILL.md…</div>
                ) : (
                  <pre className="max-h-[400px] overflow-auto p-4 font-mono text-[12px] leading-relaxed text-[var(--fg-secondary)] whitespace-pre-wrap break-words">
                    {source?.content || '无内容'}
                  </pre>
                )}
              </div>
            </TabsContent>

            <TabsContent value="diff" className="space-y-3 focus:outline-none">
              {loadingHistory ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-xs text-[var(--fg-muted)]">
                  正在读取本地 Git 提交历史…
                </div>
              ) : !history?.commits?.length ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-xs text-[var(--fg-muted)]">
                  未检测到该 SKILL.md 的本地 Git 提交记录（可能不在 Git 仓库中或尚未提交）。
                </div>
              ) : (
                <>
                  <div className="max-h-44 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    {history.commits.map((c) => {
                      const active = c.hash === activeHash;
                      return (
                        <button
                          key={c.hash}
                          type="button"
                          onClick={() => setSelectedCommit(c.hash)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-xs transition-colors cursor-pointer',
                            active
                              ? 'bg-[var(--surface-2)] text-[var(--fg)]'
                              : 'hover:bg-[var(--surface-hover)]/60 text-[var(--fg-secondary)]',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-[11px] text-[var(--info)]">{c.shortHash}</code>
                              <span className="truncate font-medium">{c.subject}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-[var(--fg-muted)]">
                              {c.author} · {c.date.slice(0, 16)}
                            </div>
                          </div>
                          {active && <Badge tone="info">当前查看</Badge>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    {loadingDiff ? (
                      <div className="p-4 text-xs text-[var(--fg-muted)]">正在加载提交 Diff…</div>
                    ) : (
                      <DiffViewer diff={diffData?.diff ?? ''} />
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

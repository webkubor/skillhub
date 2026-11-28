'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  HelpCircle,
  Layers,
  Lock,
  Moon,
  RefreshCw,
  Search,
  ShieldAlert,
  Sun,
  Terminal,
  Unlock,
  X,
} from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchOverview, triggerRefresh, updateVisibility } from '@/lib/api';
import type { AuditFinding, OverviewResponse, RepoRelation, SkillItem, VisibilityStatus } from '@/lib/types';
import { cn, formatPercent } from '@/lib/utils';
import { AnalyticsView } from './analytics-view';
import { OnboardingGuide } from './onboarding-guide';
import { SkillDrawer } from './skill-drawer';
import { AgentBadge, AgentIcon, detectRuntimeAgents } from './ui/agent-badge';
import { BrandLogo } from './ui/brand-logo';
import { Badge, Button, StatusDot } from './ui/primitives';

const RELATION_META: Record<RepoRelation, { label: string; tone: 'ok' | 'warn' | 'info' | 'neutral' }> = {
  'own-public': { label: '自有开源', tone: 'ok' },
  'own-private': { label: '自有私有', tone: 'warn' },
  'third-party': { label: '第三方', tone: 'info' },
  unlinked: { label: '未关联', tone: 'neutral' },
};

type ControlEvent = {
  action: 'refresh' | 'tab' | 'focus' | 'theme' | 'filter' | 'toast';
  tab?: string;
  skill?: string;
  theme?: 'dark' | 'light';
  query?: string;
  visibility?: string;
  message?: string;
};

export function Dashboard() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [guideOpen, setGuideOpen] = useState(false);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [pendingSkill, setPendingSkill] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL as State via nuqs
  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('skills'));
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [visFilter, setVisFilter] = useQueryState('vis', parseAsString.withDefault('all'));
  const [relFilter, setRelFilter] = useQueryState('rel', parseAsString.withDefault('all'));
  const [includeArchived, setIncludeArchived] = useQueryState('archived', parseAsString.withDefault('0'));
  const [sortBy, setSortBy] = useQueryState('sort', parseAsString.withDefault('uses'));

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  };

  const applyTheme = (next: 'dark' | 'light') => {
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem('skillhub-theme', next);
  };

  useEffect(() => {
    const saved = window.localStorage.getItem('skillhub-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: tab === 'analytics' ? 10_000 : false,
  });

  // Real-time CLI -> Web SSE Control Channel
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
    const es = new EventSource(`${base}/api/events`);

    es.addEventListener('ready', () => setSseConnected(true));
    es.onerror = () => setSseConnected(false);

    es.addEventListener('control', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as ControlEvent;
        if (evt.action === 'refresh') {
          void queryClient.invalidateQueries({ queryKey: ['overview'] });
        } else if (evt.action === 'tab' && evt.tab) {
          void setTab(evt.tab);
        } else if (evt.action === 'focus' && evt.skill) {
          void setTab('skills');
          setSelectedSkillName(evt.skill);
        } else if (evt.action === 'theme' && evt.theme) {
          applyTheme(evt.theme);
        } else if (evt.action === 'filter') {
          void setTab('skills');
          if (typeof evt.query === 'string') void setSearch(evt.query || null);
          if (evt.visibility) void setVisFilter(evt.visibility);
        }
        if (evt.message) showToast(`CLI · ${evt.message}`);
      } catch {
        // ignore malformed event
      }
    });

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [queryClient, setSearch, setTab, setVisFilter]);

  const refreshMutation = useMutation({
    mutationFn: triggerRefresh,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      showToast('已重新扫描本机 Skills');
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ skill, status }: { skill: string; status: VisibilityStatus }) =>
      updateVisibility(skill, status),
    onMutate: async ({ skill, status }) => {
      setPendingSkill(skill);
      await queryClient.cancelQueries({ queryKey: ['overview'] });
      const prev = queryClient.getQueryData<OverviewResponse>(['overview']);
      if (prev) {
        const nextSkills = prev.skills.map((s) =>
          s.name === skill ? { ...s, visibility: status, visibility_source: 'explicit' as const } : s,
        );
        queryClient.setQueryData<OverviewResponse>(['overview'], {
          ...prev,
          skills: nextSkills,
          summary: {
            ...prev.summary,
            openCount: nextSkills.filter((s) => s.visibility === 'open').length,
            closedCount: nextSkills.filter((s) => s.visibility === 'closed').length,
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['overview'], ctx.prev);
    },
    onSettled: () => {
      setPendingSkill(null);
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const findingsBySkill = useMemo(() => {
    const map = new Map<string, AuditFinding[]>();
    for (const f of data?.audit?.findings ?? []) {
      const list = map.get(f.skill) ?? [];
      list.push(f);
      map.set(f.skill, list);
    }
    return map;
  }, [data?.audit?.findings]);

  const selectedSkill = useMemo<SkillItem | null>(() => {
    if (!selectedSkillName || !data?.skills) return null;
    return (
      data.skills.find((s) => s.name === selectedSkillName) ??
      data.skills.find((s) => s.name.toLowerCase().includes(selectedSkillName.toLowerCase())) ??
      null
    );
  }, [data?.skills, selectedSkillName]);

  const filteredSkills = useMemo(() => {
    const list = data?.skills ?? [];
    const q = search.trim().toLowerCase();

    const matched = list.filter((s) => {
      if (includeArchived !== '1' && s.lifecycle === 'archived') return false;
      if (visFilter !== 'all' && s.visibility !== visFilter) return false;
      if (relFilter !== 'all' && s.relation !== relFilter) return false;
      if (q) {
        const hay = `${s.name} ${s.description} ${s.category} ${s.origin} ${s.repo?.owner ?? ''} ${s.repo?.repo ?? ''} ${s.agents.map((a) => a.agent).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return matched.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'uses7d') return b.uses_7d - a.uses_7d || b.total_uses - a.total_uses || a.name.localeCompare(b.name);
      return b.total_uses - a.total_uses || b.uses_7d - a.uses_7d || a.name.localeCompare(b.name);
    });
  }, [data?.skills, search, visFilter, relFilter, includeArchived, sortBy]);

  const summary = data?.summary;
  const detectedRuntimes = useMemo(() => detectRuntimeAgents(data?.scannedRoots ?? []), [data?.scannedRoots]);
  const totalIssues = (summary?.auditErrorCount ?? 0) + (summary?.doctorProblemsCount ?? 0);

  const selectQuickFilter = (vis: string, rel: string) => {
    void setTab('skills');
    void setVisFilter(vis);
    void setRelFilter(rel);
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Left Navigation Sidebar (Linear / Raycast-grade calm rail) */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] md:flex">
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="h-5 w-5" />
            <span className="text-[13.5px] font-semibold tracking-tight text-[var(--fg)]">SkillHub</span>
          </div>
          <span
            title={sseConnected ? 'CLI 实时联动已连接' : 'CLI 联动未连接'}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[var(--fg-muted)]"
          >
            <StatusDot tone={sseConnected ? 'ok' : 'neutral'} pulse={sseConnected} />
            <span>{sseConnected ? 'Live' : 'Idle'}</span>
          </span>
        </div>

        {/* Primary Workspace Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-2.5 py-2">
          <div className="space-y-0.5">
            <SidebarItem
              active={tab === 'skills' && visFilter === 'all' && relFilter === 'all'}
              onClick={() => selectQuickFilter('all', 'all')}
              icon={<Layers className="h-3.5 w-3.5" />}
              label="全部 Skills"
              count={summary?.totalSkills}
            />
            <SidebarItem
              active={tab === 'analytics'}
              onClick={() => void setTab('analytics')}
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              label="调用统计"
              count={summary?.uses7d ? `${summary.uses7d} / 7d` : undefined}
            />
            <SidebarItem
              active={tab === 'relations'}
              onClick={() => void setTab('relations')}
              icon={<GitBranch className="h-3.5 w-3.5" />}
              label="仓库映射"
              count={
                summary
                  ? summary.ownPublicCount + summary.ownPrivateCount + summary.thirdPartyCount
                  : undefined
              }
            />
            <SidebarItem
              active={tab === 'doctor'}
              onClick={() => void setTab('doctor')}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label="安全与诊断"
              count={totalIssues > 0 ? totalIssues : undefined}
              alert={totalIssues > 0}
            />
          </div>

          {/* Quick Views (replaces ugly dropdown selects) */}
          <div>
            <div className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">
              视图筛选
            </div>
            <div className="space-y-0.5">
              <SidebarItem
                active={tab === 'skills' && visFilter === 'open' && relFilter === 'all'}
                onClick={() => selectQuickFilter('open', 'all')}
                icon={<Unlock className="h-3.5 w-3.5 text-[var(--ok)]" />}
                label="开源口径"
                count={summary?.openCount}
              />
              <SidebarItem
                active={tab === 'skills' && visFilter === 'closed' && relFilter === 'all'}
                onClick={() => selectQuickFilter('closed', 'all')}
                icon={<Lock className="h-3.5 w-3.5 text-[var(--warn)]" />}
                label="闭源口径"
                count={summary?.closedCount}
              />
              <SidebarItem
                active={tab === 'skills' && relFilter === 'own-public'}
                onClick={() => selectQuickFilter('all', 'own-public')}
                icon={<StatusDot tone="ok" />}
                label="自有开源仓"
                count={summary?.ownPublicCount}
              />
              <SidebarItem
                active={tab === 'skills' && relFilter === 'own-private'}
                onClick={() => selectQuickFilter('all', 'own-private')}
                icon={<StatusDot tone="warn" />}
                label="自有私有仓"
                count={summary?.ownPrivateCount}
              />
              <SidebarItem
                active={tab === 'skills' && relFilter === 'third-party'}
                onClick={() => selectQuickFilter('all', 'third-party')}
                icon={<StatusDot tone="info" />}
                label="第三方来源"
                count={summary?.thirdPartyCount}
              />
            </div>
          </div>

          {/* Detected Local Runtimes */}
          {detectedRuntimes.length > 0 && (
            <div>
              <div className="mb-2 px-2.5 text-[10px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">
                本地运行时
              </div>
              <div className="flex flex-wrap gap-1.5 px-2">
                {detectedRuntimes.map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => {
                      void setTab('skills');
                      void setSearch(rt);
                    }}
                    title={`筛选 ${rt}`}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-mono text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)] cursor-pointer"
                  >
                    <AgentIcon agent={rt} className="h-3 w-3" />
                    <span>{rt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Minimal Sidebar Footer */}
        <div className="border-t border-[var(--border)] px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(data?.cliStatus ?? []).map((cli) => {
                const ok = cli.hosts.some((h) => h.state === 'ok');
                return (
                  <span
                    key={cli.cli}
                    title={cli.hosts.map((h) => `${h.host}: ${h.state}`).join(' | ') || cli.detail}
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--fg-muted)]"
                  >
                    <StatusDot tone={ok ? 'ok' : 'neutral'} />
                    {cli.cli}
                  </span>
                );
              })}
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                title="重新扫描"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] cursor-pointer"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshMutation.isPending && 'animate-spin')} />
              </button>
              <button
                type="button"
                onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
                title="切换明暗主题"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                title="AI 引导与 CLI 遥控命令"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Crisp Single-line Top Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--bg)_90%,transparent)] px-6 backdrop-blur-md">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="text-sm font-semibold text-[var(--fg)]">
              {tab === 'skills' && (visFilter === 'open' ? '开源 Skills' : visFilter === 'closed' ? '闭源 Skills' : 'Skills')}
              {tab === 'analytics' && '调用统计'}
              {tab === 'relations' && '仓库映射'}
              {tab === 'doctor' && '安全与诊断'}
            </h1>
            {summary && tab === 'skills' && (
              <span className="hidden truncate font-mono text-[11px] text-[var(--fg-muted)] tabular-nums sm:inline">
                {filteredSkills.length} / {summary.totalSkills} · {summary.openCount} 开源 · {summary.closedCount} 闭源 · 近 7d {summary.uses7d} 次
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {tab === 'skills' && (
              <>
                <div className="relative w-56 sm:w-64">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value || null)}
                    placeholder="搜索 Skill、Agent 或仓库…"
                    className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-8 pr-8 text-xs text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-strong)] focus:outline-none"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch(null)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                      aria-label="清空搜索"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[var(--fg-muted)]">
                      /
                    </kbd>
                  )}
                </div>

                {/* Minimal Segmented Sort Control (replaces ugly select) */}
                <div className="hidden items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[11px] lg:inline-flex">
                  {(
                    [
                      ['uses', '总调用'],
                      ['uses7d', '近 7d'],
                      ['name', '名称'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void setSortBy(key)}
                      className={cn(
                        'rounded-md px-2 py-1 font-medium transition-colors cursor-pointer',
                        sortBy === key
                          ? 'bg-[var(--surface-2)] text-[var(--fg)]'
                          : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void setIncludeArchived(includeArchived === '1' ? '0' : '1')}
                  className={cn(
                    'hidden h-8 items-center rounded-lg border px-2.5 text-[11px] transition-colors cursor-pointer xl:inline-flex',
                    includeArchived === '1'
                      ? 'border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--fg)]'
                      : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]',
                  )}
                >
                  含归档
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1">
          {isLoading && (
            <div className="space-y-px p-6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-[var(--surface)]" />
              ))}
            </div>
          )}

          {isError && (
            <div className="m-6 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-xs text-[var(--danger)]">
              加载失败：{(error as Error)?.message ?? '未知错误'}
            </div>
          )}

          {data && summary && tab === 'skills' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] font-medium text-[var(--fg-muted)]">
                    <th className="py-2.5 pl-6 pr-4 font-medium">Skill</th>
                    <th className="px-3 py-2.5 font-medium">版本</th>
                    <th className="px-3 py-2.5 font-medium">口径</th>
                    <th className="px-3 py-2.5 font-medium">仓库</th>
                    <th className="py-2.5 pl-3 pr-6 text-right font-medium">调用 · Agents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70">
                  {filteredSkills.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-xs text-[var(--fg-muted)]">
                        没有匹配的 Skill
                        {(search || visFilter !== 'all' || relFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              void setSearch(null);
                              void setVisFilter('all');
                              void setRelFilter('all');
                            }}
                            className="ml-2 text-[var(--info)] hover:underline cursor-pointer"
                          >
                            重置筛选
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredSkills.map((skill) => {
                      const relMeta = RELATION_META[skill.relation];
                      const skillFindings = findingsBySkill.get(skill.name) ?? [];
                      const hasError = skillFindings.some((f) => f.severity === 'error');
                      const isBusy = pendingSkill === skill.name;

                      return (
                        <tr
                          key={skill.name}
                          onClick={() => setSelectedSkillName(skill.name)}
                          className="group cursor-pointer transition-colors hover:bg-[var(--surface-hover)]/70"
                        >
                          {/* 1. Skill Name + 1-line Description */}
                          <td className="max-w-[440px] py-3 pl-6 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-mono text-[13px] font-medium text-[var(--fg)] group-hover:text-[var(--info)]">
                                {skill.name}
                              </span>
                              {hasError && (
                                <span title={skillFindings[0]?.message} className="shrink-0 text-[var(--danger)]">
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                </span>
                              )}
                              {skill.lifecycle !== 'active' && (
                                <span className="font-mono text-[10px] text-[var(--fg-muted)]">
                                  {skill.lifecycle}
                                </span>
                              )}
                            </div>
                            {skill.description && (
                              <p className="mt-0.5 truncate text-[12px] text-[var(--fg-muted)]">
                                {skill.description}
                              </p>
                            )}
                          </td>

                          {/* 2. Version & Category */}
                          <td className="whitespace-nowrap px-3 py-3">
                            <div className="font-mono text-[12px] text-[var(--fg-secondary)]">
                              {skill.version ? `v${skill.version.replace(/^v/, '')}` : '—'}
                            </div>
                            {skill.category && (
                              <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{skill.category}</div>
                            )}
                          </td>

                          {/* 3. Single-click Clean Visibility Toggle */}
                          <td
                            className="whitespace-nowrap px-3 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              disabled={isBusy}
                              title="点击切换本地开源/闭源口径（不修改远端 GitHub/LICENSE）"
                              onClick={() =>
                                visibilityMutation.mutate({
                                  skill: skill.name,
                                  status: skill.visibility === 'open' ? 'closed' : 'open',
                                })
                              }
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                                skill.visibility === 'open'
                                  ? 'bg-[var(--ok-soft)] text-[var(--ok)] hover:opacity-85'
                                  : 'bg-[var(--surface-2)] text-[var(--fg-secondary)] hover:text-[var(--fg)]',
                              )}
                            >
                              <StatusDot tone={skill.visibility === 'open' ? 'ok' : 'warn'} />
                              <span>{skill.visibility === 'open' ? '开源' : '闭源'}</span>
                            </button>
                          </td>

                          {/* 4. Repository */}
                          <td
                            className="whitespace-nowrap px-3 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {skill.repo ? (
                              <a
                                href={skill.repo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex max-w-[200px] items-center gap-1.5 truncate font-mono text-[11.5px] text-[var(--fg-secondary)] hover:text-[var(--fg)] hover:underline"
                              >
                                <StatusDot tone={relMeta.tone} />
                                <span className="truncate">
                                  {skill.repo.owner}/{skill.repo.repo}
                                </span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                              </a>
                            ) : (
                              <span className="text-[11.5px] text-[var(--fg-muted)]">本地</span>
                            )}
                          </td>

                          {/* 5. Calls & Minimal Agent Icons */}
                          <td className="whitespace-nowrap py-3 pl-3 pr-6 text-right">
                            <div className="inline-flex items-center justify-end gap-3">
                              {skill.agents.length > 0 && (
                                <div className="hidden items-center gap-1 text-[var(--fg-muted)] sm:flex">
                                  {skill.agents.slice(0, 3).map((a) => (
                                    <span
                                      key={a.agent}
                                      title={`${a.agent}: ${a.uses} 次`}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--surface-2)] text-[var(--fg-secondary)]"
                                    >
                                      <AgentIcon agent={a.agent} className="h-3 w-3" />
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="min-w-[56px] text-right font-mono text-[12px] tabular-nums">
                                <span className="text-[var(--fg)]">{skill.total_uses}</span>
                                {skill.total_uses > 0 && (
                                  <span className="ml-1.5 text-[11px] text-[var(--fg-muted)]">
                                    {formatPercent(skill.success_rate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {data && tab === 'analytics' && (
            <div className="p-6">
              <AnalyticsView
                skills={data.skills}
                stats={data.stats}
                reads={data.reads}
                agents={data.agents}
                problems={data.problems}
              />
            </div>
          )}

          {data && summary && tab === 'relations' && (
            <div className="overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-6 py-3 text-xs text-[var(--fg-muted)]">
                <span>
                  GitHub 账户：<code className="text-[var(--fg-secondary)]">{data.account ?? '未登录'}</code>
                </span>
                <div className="flex gap-3 font-mono text-[11px] tabular-nums">
                  <span>自有开源 {summary.ownPublicCount}</span>
                  <span>自有私有 {summary.ownPrivateCount}</span>
                  <span>第三方 {summary.thirdPartyCount}</span>
                  <span>未关联 {summary.unlinkedCount}</span>
                </div>
              </div>
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] text-[var(--fg-muted)]">
                    <th className="py-2.5 pl-6 pr-4 font-medium">Skill</th>
                    <th className="px-3 py-2.5 font-medium">归属</th>
                    <th className="px-3 py-2.5 font-medium">仓库</th>
                    <th className="py-2.5 pl-3 pr-6 text-right font-medium">识别方式</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70">
                  {data.skills
                    .filter((s) => s.repo)
                    .map((s) => {
                      const meta = RELATION_META[s.relation];
                      return (
                        <tr
                          key={s.name}
                          onClick={() => setSelectedSkillName(s.name)}
                          className="cursor-pointer hover:bg-[var(--surface-hover)]/70"
                        >
                          <td className="py-3 pl-6 pr-4 font-mono font-medium text-[var(--fg)]">{s.name}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 text-[var(--fg-secondary)]">
                              <StatusDot tone={meta.tone} />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={s.repo!.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[var(--info)] hover:underline"
                            >
                              {s.repo!.host}/{s.repo!.owner}/{s.repo!.repo}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                          <td className="py-3 pl-3 pr-6 text-right font-mono text-[11px] text-[var(--fg-muted)]">
                            {s.via ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {data && tab === 'doctor' && (
            <div className="max-w-4xl space-y-6 p-6">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                    上架前安全与口径门禁
                  </h2>
                  <div className="flex gap-2">
                    <Badge tone={data.audit.errorCount > 0 ? 'danger' : 'ok'}>阻断 {data.audit.errorCount}</Badge>
                    <Badge tone={data.audit.warnCount > 0 ? 'warn' : 'neutral'}>建议 {data.audit.warnCount}</Badge>
                  </div>
                </div>
                {data.audit.findings.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--ok)]">
                    所有 Skill 均通过安全与口径一致性检查。
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    {data.audit.findings.map((f, idx) => (
                      <div
                        key={`${f.skill}-${f.rule}-${idx}`}
                        onClick={() => setSelectedSkillName(f.skill)}
                        className="flex items-center justify-between gap-4 px-4 py-3 text-xs hover:bg-[var(--surface-hover)] cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <StatusDot tone={f.severity === 'error' ? 'danger' : 'warn'} />
                            <span className="font-mono font-medium text-[var(--fg)]">{f.skill}</span>
                            <span className="text-[var(--fg-secondary)]">{f.message}</span>
                          </div>
                          <p className="mt-0.5 pl-4 text-[11px] text-[var(--fg-muted)]">{f.suggestion}</p>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-[var(--info)]">修复 →</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                  已扫描目录（{data.scannedRoots.length}）
                </h2>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {data.scannedRoots.map((root) => (
                    <div
                      key={root}
                      className="truncate rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-[11px] text-[var(--fg-secondary)]"
                    >
                      {root}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Onboarding & CLI Remote Control Modal (kept out of the main canvas) */}
      <DialogPrimitive.Root open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl focus:outline-none">
            <div className="max-h-[85vh] overflow-y-auto p-5 space-y-4">
              {data && (
                <OnboardingGuide
                  data={data}
                  onDismiss={() => setGuideOpen(false)}
                  onJumpTab={(nextTab) => {
                    setGuideOpen(false);
                    void setTab(nextTab);
                  }}
                />
              )}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
                <div className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--fg)]">
                  <Terminal className="h-3.5 w-3.5 text-[var(--info)]" />
                  <span>CLI 实时遥控网页（SSE Live）</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 font-mono text-[11px] text-[var(--fg-secondary)] sm:grid-cols-2">
                  <code>skillhub ui tab analytics</code>
                  <code>skillhub ui focus &lt;skill&gt;</code>
                  <code>skillhub ui search bloom</code>
                  <code>skillhub ui theme light</code>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Subtle Floating Toast for CLI Events */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 font-mono text-xs text-[var(--fg)] shadow-lg">
          <StatusDot tone="ok" />
          <span>{toast}</span>
        </div>
      )}

      {/* Slide-over Skill Detail Drawer */}
      <SkillDrawer
        skill={selectedSkill}
        findings={selectedSkill ? findingsBySkill.get(selectedSkill.name) ?? [] : []}
        open={!!selectedSkill}
        onOpenChange={(open) => !open && setSelectedSkillName(null)}
      />
    </div>
  );
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  count,
  alert = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number | string;
  alert?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors cursor-pointer',
        active
          ? 'bg-[var(--surface-2)] font-medium text-[var(--fg)]'
          : 'text-[var(--fg-secondary)] hover:bg-[var(--surface-hover)]/60 hover:text-[var(--fg)]',
      )}
    >
      <span className="flex items-center gap-2 truncate">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && (
        <span
          className={cn(
            'font-mono text-[11px] tabular-nums',
            alert ? 'text-[var(--danger)] font-semibold' : 'text-[var(--fg-muted)]',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

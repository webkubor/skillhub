'use client';

import { Check, Copy, Sparkles, Terminal, ShieldAlert, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
import type { OverviewResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AgentBadge, detectRuntimeAgents } from './ui/agent-badge';
import { Badge, Button, Card } from './ui/primitives';

function CopyButton({ text, label = '复制命令' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };
  return (
    <Button variant="default" size="sm" onClick={onCopy} className="shrink-0">
      {copied ? <Check className="h-3 w-3 text-[var(--ok)]" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? '已复制' : label}</span>
    </Button>
  );
}

export function OnboardingGuide({
  data,
  onDismiss,
  onJumpTab,
}: {
  data: OverviewResponse;
  onDismiss: () => void;
  onJumpTab: (tab: string) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState('claude');
  const detectedRuntimes = detectRuntimeAgents(data.scannedRoots);
  const firstSkill = data.skills[0]?.name ?? 'demo-skill';
  const hasTelemetry = data.summary.totalUses > 0;
  const hasCliAuth = data.cliStatus.some((c) => c.hosts.some((h) => h.state === 'ok'));
  const auditErrors = data.audit?.errorCount ?? 0;
  const auditWarns = data.audit?.warnCount ?? 0;

  const telemetryCmd = `skillhub use ${firstSkill} --outcome success --agent ${selectedAgent}`;
  const aiFixPrompt =
    auditErrors + auditWarns > 0
      ? `请帮我检查并修复以下 SkillHub 审计告警（共 ${auditErrors} 个错误、${auditWarns} 个提醒）：\n${(data.audit?.findings ?? [])
          .slice(0, 6)
          .map((f) => `- [${f.severity}] ${f.skill}: ${f.message}（建议：${f.suggestion}）`)
          .join('\n')}`
      : `请帮我为 ${firstSkill} 补充更清晰的 SKILL.md 触发条件与版本号，然后运行 skillhub doctor 验证。`;

  const steps = [
    {
      num: '01',
      title: '本机资产与 Agent 运行时发现',
      done: data.summary.totalSkills > 0,
      desc: `已扫描 ${data.scannedRoots.length} 个目录，发现 ${data.summary.totalSkills} 个 Skill。`,
    },
    {
      num: '02',
      title: 'Git 仓库与 CLI 校准',
      done: hasCliAuth,
      desc: hasCliAuth
        ? `已识别 GitHub 账号 ${data.account ?? ''}，自动区分自有开源/私有与第三方。`
        : '尚未检测到已登录的 gh/glab，运行 gh auth login 可自动校准公开/私有仓归属。',
    },
    {
      num: '03',
      title: '接入 AI 调用遥测',
      done: hasTelemetry,
      desc: hasTelemetry
        ? `已采集 ${data.summary.totalUses} 次调用（近 7 天 ${data.summary.uses7d} 次）。`
        : '在 Agent Hook 或工作流结尾写入一行 skillhub use，即可点亮频次与成功率图表。',
    },
    {
      num: '04',
      title: '上架前安全与口径门禁',
      done: auditErrors === 0,
      desc:
        auditErrors === 0
          ? auditWarns > 0
            ? `无阻断错误（有 ${auditWarns} 条元信息优化建议）。`
            : '无闭源冲突与明文凭据风险，可随时打包分发。'
          : `检测到 ${auditErrors} 项阻断级风险（闭源/公开仓冲突或敏感凭据），建议立即处理。`,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <Card className="overflow-hidden border-[color-mix(in_oklch,var(--info)_32%,var(--border))]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-[var(--info)]" />
          <span className="text-xs font-semibold text-[var(--fg)]">AI 自动化与上手引导</span>
          <Badge tone={completedCount === 4 ? 'ok' : 'info'}>
            已完成 {completedCount} / 4
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {detectedRuntimes.length > 0 && (
            <div className="hidden items-center gap-1.5 lg:flex">
              <span className="text-[11px] text-[var(--fg-muted)]">已接入运行时：</span>
              {detectedRuntimes.map((rt) => (
                <AgentBadge key={rt} agent={rt} compact />
              ))}
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="收起引导">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div
            key={s.num}
            className={cn(
              'flex flex-col justify-between rounded-lg border p-3 text-xs',
              s.done
                ? 'border-[var(--border)] bg-[var(--bg)]/60'
                : 'border-[color-mix(in_oklch,var(--info)_35%,var(--border))] bg-[var(--info-soft)]/35',
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[var(--fg-muted)]">{s.num}</span>
                <Badge tone={s.done ? 'ok' : 'warn'}>{s.done ? '就绪' : '待完成'}</Badge>
              </div>
              <div className="mt-2 font-medium text-[var(--fg)]">{s.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-muted)]">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick AI Automation Action Bar */}
      <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--bg)]/50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Terminal className="h-3.5 w-3.5 text-[var(--info)]" />
          <span className="text-[var(--fg-muted)]">快速测试遥测：</span>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            aria-label="选择目标 Agent"
            className="h-7 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 font-mono text-[11px] text-[var(--fg)]"
          >
            <option value="claude">claude</option>
            <option value="codex">codex</option>
            <option value="gemini">gemini</option>
            <option value="cursor">cursor</option>
            <option value="dsh">dsh</option>
            <option value="opencode">opencode</option>
          </select>
          <code className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[11px] text-[var(--info)]">
            {telemetryCmd}
          </code>
          <CopyButton text={telemetryCmd} label="复制命令" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={aiFixPrompt} label="复制 AI 自动巡检/修复 Prompt" />
          {auditErrors + auditWarns > 0 && (
            <Button variant="subtle" size="sm" onClick={() => onJumpTab('doctor')}>
              <ShieldAlert className="h-3.5 w-3.5 text-[var(--warn)]" />
              <span>查看 {auditErrors + auditWarns} 条审计项</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

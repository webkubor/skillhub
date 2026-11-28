/**
 * 默认扫描根与排除前缀。
 *
 * 顺序有意义：先扫到的同名 Skill 生效，后面的只记进 duplicates。
 * 所以「本仓薄插件」必须排在 CS 仓旧厚入口之前。
 */
export const DEFAULT_ROOTS = [
  '~/dev/agent-infra',               // 本仓薄插件优先，盖掉 CS 仓里的旧厚入口
  '~/dev/cs/CortexOS/skills',
  '~/dev/agent-skills/writing-standard-skills/skills',
  '~/dev/agent-skills',
  '~/dev/visual/ui-craft/skills',
  '~/.agents/skills',
  '~/.claude/skills',
  '~/.codex/skills',
  '~/.gemini/config/skills',
  '~/.dsh/skills',
  '~/.cursor/skills',
  '~/.config/opencode/skills',
];

/**
 * 带 SKILL.md 但不是真源的目录（按 realpath 前缀排除）。
 *
 * 这些是生成物或编进二进制的内嵌副本，把它们当 Skill 真源会制造假冲突：
 * - magpie 按运行时生成路由缓存，每个变体目录都复制一份 SKILL.md
 * - kyvault 的 `rust/assets/SKILL.md` 是 `include_str!` 编进二进制的 guide 副本
 *
 * 被排除的路径会出现在 `scan --json` 的 `excluded` 里，不是静默丢弃。
 */
export const DEFAULT_EXCLUDES = [
  '~/.config/magpie/skill-router',
  '~/dev/agent-infra/kyvault/rust/assets',
];

/**
 * 上游有意保留的同名对（必须写理由与被遮蔽路径，未列全不放行）。
 *
 * kyvault：`~/.agents/skills/kyvault` 是正文，`~/.claude/skills/kyvault` 是
 * 带 `disable-model-invocation: true` 的指针 shim —— 仓内 `scripts/check-agent-guide.py`
 * 会校验「shim 只指回正文且禁止隐式调用」这对契约，删任一侧都会让上游校验失败。
 */
export const DEFAULT_ALLOWED_DUPLICATES = [
  {
    name: 'kyvault',
    paths: ['~/.claude/skills/kyvault/SKILL.md'],
    reason: '上游契约：Claude 侧为禁用隐式调用的指针 shim，正文在 ~/.agents/skills/kyvault',
  },
];

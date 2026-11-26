# SkillHub 本地网页设计契约

> 适用范围：`skillhub serve` 托管的本机 `127.0.0.1:4319` 控制台（`web/` Next.js App Router 静态导出 + `src/web.ts` Hono API 单端口服务）。

## 品牌与定位

- 品牌标识：1:1 透明底六边形核心路由标识（[assets/logo.svg](assets/logo.svg)、[web/public/favicon.svg](web/public/favicon.svg)、[brand-logo.tsx](web/src/components/ui/brand-logo.tsx)），呼应「多 Agent 节点汇聚单一 Skill 真源核心」的产品心智，明暗双色自动继承 Bloom OKLCH 语义变量。
- 定位：本机 Skill 资产控制面（清单、调用遥测、Git 版本 Diff、仓库关系、上架前安全审计、本地口径与生命周期管理）。
- 语气：高信息密度的工程师控制台，遵循「把审美做成可验证的工程」——柔和克制、层次分明、无营销装饰。
- 架构边界：
  - 前端：`web/` — Next.js (App Router, `output: 'export'`) + Tailwind CSS v4 + Radix/shadcn 原语 + TanStack Query + Nuqs（URL as State）+ Recharts + 定制 Agent 矢量图标（`agent-badge.tsx`）+ 动态上手引导（`onboarding-guide.tsx`）。
  - 后端：`src/web.ts` — Hono + `@hono/node-server` + Zod，单端口同时提供 `/api/*`（含 `/api/audit` 与 `/api/skills/:name/{source,history,diff}`）与 `web/out` 静态文件托管。
  - 持久化：本机 Git/Markdown 文件为 Skill 源码真源，本机 `node:sqlite`（`~/.local/state/skillhub/usage.sqlite`）为遥测与管理口径真源。

## 视觉系统（Bloom OKLCH 明暗双色）

以三层表面色阶区分画布、面板与表头，避免纯黑底配荧光高饱和色；所有语义色均按 WCAG AA 对比度调校。

### Dark（默认，Obsidian Morandi）

| Token | OKLCH 值 | 用途 |
|---|---|---|
| `--bg` | `oklch(0.155 0.010 255)` | 页面底色 |
| `--surface` | `oklch(0.192 0.012 255)` | 卡片、主表容器、侧边抽屉顶栏 |
| `--surface-2` | `oklch(0.228 0.014 255)` | 表头、激活 Tab、徽标底色 |
| `--border` | `oklch(0.295 0.014 255)` | 常规描边与表格分割线 |
| `--fg` | `oklch(0.935 0.008 255)` | 主正文 |
| `--fg-muted` | `oklch(0.665 0.014 255)` | 次要元信息 |
| `--ok` | `oklch(0.765 0.105 155)` | 正常 / 开源 / 自有公开 / 在线 |
| `--warn` | `oklch(0.785 0.110 68)` | 闭源 / 自有私有 / 提醒 |
| `--danger` | `oklch(0.725 0.125 22)` | 失败 / 损坏 |
| `--info` | `oklch(0.765 0.095 245)` | 链接 / 第三方仓库 / 焦点轮廓 |

### Light（Parchment Morandi，顶栏可一键切换）

| Token | OKLCH 值 | 用途 |
|---|---|---|
| `--bg` | `oklch(0.972 0.006 85)` | 浅色宣纸底 |
| `--surface` | `oklch(0.994 0.003 85)` | 卡片与表格面 |
| `--surface-2` | `oklch(0.948 0.008 85)` | 表头与次级面 |
| `--fg` | `oklch(0.215 0.014 255)` | 深墨正文 |

## 布局与组件模式

- **容器**：居中 `max-w-[1360px]`，顶栏 sticky 玻璃态，收纳品牌、CLI 状态点（`gh`/`glab`）、合规说明开关、刷新按钮与明暗切换。
- **KPI 摘要条**：4 卡并列（Skill 资产总数 + Doctor 状态、开源/闭源比例条、近 30d/7d 调用与成功率、仓库映射分布）。
- **主视图 Tab（URL 状态化）**：通过 `nuqs` 将 `tab / q / vis / lifecycle / rel / sort` 同步至 URL 查询参数，支持刷新与分享不丢状态。
  - `Skills 控制台`：合并原先四张重复表，提供即时搜索、口径/生命周期/仓库筛选、排序、内联乐观更新开关（无整页闪屏），点击行滑出侧边抽屉查看 `SKILL.md` 源码与 Agent 分布。
  - `调用统计`：Recharts 横向高频排行图 + Agent 堆叠分布图 + 调用明细表 + 异常记录。
  - `仓库关系`：GitHub/GitLab 仓库归属表与外链。
  - `健康诊断`：Doctor 检查结果、损坏文件与已扫描根目录。
- **排版与无障碍**：
  - 禁用系统 Emoji 充当状态图标，统一用 6px CSS `StatusDot` + Lucide 线性图标。
  - 所有计数、百分比、时间戳强制 `font-mono tabular-nums` 并右对齐。
  - 所有交互控件具备 `:focus-visible` 轮廓（`--info`）与 `aria-pressed` / `aria-label`。

## Do / Don't

- Do：所有颜色引用 CSS 变量 tokens；写操作仅限于本机 SQLite 的 `POST /api/visibility` 与 `POST /api/lifecycle`。
- Don't：不自动修改 GitHub/GitLab 远端可见性、LICENSE 或外部商品配置；不复制 Skill 正文进仓库数据库。

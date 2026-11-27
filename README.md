![SkillHub Logo](./assets/logo.svg)

# SkillHub `v1.0.0`

本机优先的 AI Agent Skill 控制面：全运行时扫描、健康诊断、上架前安全审计、Git 版本 Diff、调用遥测、极简侧栏控制台与 CLI 实时遥控（SSE）。**Skills 能力全部下放这里维护，CS 系统只做薄消费端（能读能用），不承担管理逻辑。**

## 定位
- 真源：Skill 正文在各源仓的 `SKILL.md`；skillhub 只做索引与遥测，不复制正文。
- 遥测：本地 SQLite（`node:sqlite`，零外部依赖），不写任何外部系统的第二份真源。
- CS：`integrations/cs/` 里只有一个薄 Skill 入口；规则正文与版本以本仓为准。

## 快速开始
```bash
npm install && npm --prefix web install
npm run build:all
./install.sh                          # 装到 ~/.local/bin/skillhub，并幂等注册 CS 薄入口
skillhub scan --json
skillhub doctor
skillhub audit
skillhub use demo --outcome success --agent claude
skillhub profile demo --json
skillhub visibility demo closed --note "commercial build"
skillhub stats --json
skillhub serve --port 4319            # http://127.0.0.1:4319
```

## 命令
| 命令 | 用途 |
|---|---|
| `scan` | Skill 清单/分类/来源，`--json` |
| `doctor` | 坏 frontmatter + 自管无版本，退出码 1 表示有问题 |
| `audit [--json]` | 上架前安全与口径冲突门禁（闭源/公开仓冲突、明文密钥、`publish: never`、缺版本号/描述），阻断返回退出码 1 |
| `use <skill> --outcome ...` | 记一次使用（success/partial/failed） |
| `status [--json]` | gh/glab CLI 登录状态（多 host） |
| `relations [--json]` | Skill ↔ GitHub/GitLab 仓库关系：git remote/frontmatter 匹配，按当前账户公开仓校准，分自有开源/自有私有/第三方/未关联 |
| `stats` / `problems` | 次数、成功率、最近使用、问题清单，`--skill` 过滤 |
| `frequency [days]` | 近 N 天使用频次与调用 agent 数，默认 7 天；`--skill` 过滤 |
| `agents` | 按 skill + agent 聚合使用次数；`--skill` 过滤 |
| `profile [<skill>]` | 每个 Skill 的合并档案：版本、生命周期、总次数、7/30 天频次、agent 分布 |
| `lifecycle <skill> <status>` | 设置生命周期 `draft\|active\|deprecated\|archived`，`--note` 写原因 |
| `visibility <skill> open\|closed` | 设置本地开源/闭源口径，`--note` 写原因；不改 GitHub/LICENSE/外部商品配置 |
| `serve` | Hono 单端口服务（托管极简侧栏 Next.js 控制台、REST API 与 `/api/events` SSE 推流） |
| `ui <tab\|focus\|search\|theme\|refresh>` | 通过 SSE 实时遥控已打开的本地网页（切页、弹抽屉、过滤、换主题、刷新） |

扫描默认覆盖源仓 + 全运行时目录（`~/.claude`、`~/.codex`、`~/.gemini`、`~/.agents`、`~/.dsh`、`~/.cursor`、`~/.config/opencode`），软链会跟随；同名按根顺序去重，独立仓优先。
`SKILLHUB_DATA_DIR` 可改 SQLite 位置；`--root` 可改扫描根（可重复）。

## 文档
- [DESIGN.md](DESIGN.md)：Bloom OKLCH 视觉体系、品牌 Logo 与组件契约。
- [ADR-001 技术决策](docs/adr-001-tech-stack.md)：为什么保持轻量栈、CS 为什么只做消费端。
- [CS 集成契约](docs/cs-integration.md)：薄消费边界与接入方式。
- [SkillPay 合同审阅](docs/skillpay-contract-notes.md)：售卖自有 SKILL 的边界、开源/闭源切换的法律含义与上架清单。
- [线上分发平台清单](docs/distribution-platforms.md)：腾讯云 SkillHub / 支付宝 SkillPay，仅登记未接入。
- [SKILL.md](SKILL.md)：给 Agent 的用法说明。

## 状态
`1.0.0`：完成本机 SkillHub 完整闭环——Hono + Zod + SSE 后端、极简左侧栏 Next.js 明暗双色控制台、透明底 SVG 品牌标识、Agent 专属矢量图标、`skillhub audit` 上架前安全门禁（含 `publish: never`）、本地 Git 版本历史与 Diff、`skillhub ui` 终端实时遥控网页；`npm test` 全部通过。网页来源切换只改本地 SQLite，不改 GitHub 可见性、LICENSE 或外部商品配置。CS 不参与管理，也不作为迁移源或路线图依据。

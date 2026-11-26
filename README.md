# skillhub

本机 Skills 的独立仓库：扫描、健康、遥测、统计与只读网页。**Skills 能力全部下放这里维护，CS 系统只做薄消费端（能读能用），不承担管理逻辑。**

## 定位
- 真源：Skill 正文在各源仓的 `SKILL.md`；skillhub 只做索引与遥测，不复制正文。
- 遥测：本地 SQLite（`node:sqlite`，零外部依赖），不写任何外部系统的第二份真源。
- CS：`integrations/cs/` 里只有一个薄 Skill 入口；规则正文与版本以本仓为准。

## 快速开始
```bash
npm install
npm run build
./install.sh                          # 装到 ~/.local/bin/skillhub
skillhub scan --json
skillhub doctor
skillhub use demo --outcome success --agent me
skillhub profile demo --json
skillhub stats --json
skillhub serve --port 4319            # http://127.0.0.1:4319
```

## 命令
| 命令 | 用途 |
|---|---|
| `scan` | Skill 清单/分类/来源，`--json` |
| `doctor` | 坏 frontmatter + 自管无版本，退出码 1 表示有问题 |
| `use <skill> --outcome ...` | 记一次使用（success/partial/failed） |
| `status [--json]` | gh/glab CLI 登录状态小灯（多 host，逐个显示 🟢/🔴/🟡/⚪） |
| `relations [--json]` | Skill ↔ GitHub/GitLab 仓库关系：git remote/frontmatter 匹配，按当前账户公开仓校准，分自有开源/自有私有/第三方/未关联 |
| `stats` / `problems` | 次数、成功率、最近使用、问题清单，`--skill` 过滤 |
| `frequency [days]` | 近 N 天使用频次与调用 agent 数，默认 7 天；`--skill` 过滤 |
| `agents` | 按 skill + agent 聚合使用次数；`--skill` 过滤 |
| `profile [<skill>]` | 每个 Skill 的合并档案：版本、生命周期、总次数、7/30 天频次、agent 分布 |
| `lifecycle <skill> <status>` | 设置生命周期 `draft\|active\|deprecated\|archived`，`--note` 写原因 |
| `serve` | 只读网页，含 CLI 状态灯、仓库关系、Skill 档案；端点 `/api/scan` `/api/doctor` `/api/stats` `/api/status` `/api/relations` `/api/profiles` `/api/refresh` |

扫描默认覆盖源仓 + 全运行时目录（`~/.claude`、`~/.codex`、`~/.gemini`、`~/.agents`、`~/.dsh`、`~/.cursor`、`~/.config/opencode`），软链会跟随；同名按根顺序去重，独立仓优先。
`SKILLHUB_DATA_DIR` 可改 SQLite 位置；`--root` 可改扫描根（可重复）。

## 文档
- [ADR-001 技术决策](docs/adr-001-tech-stack.md)：为什么保持轻量栈、CS 为什么只做消费端。
- [CS 集成契约](docs/cs-integration.md)：薄消费边界与接入方式。
- [线上分发平台清单](docs/distribution-platforms.md)：腾讯云 SkillHub / 支付宝 SkillPay，仅登记未接入。
- [SKILL.md](SKILL.md)：给 Agent 的用法说明。

## 状态
0.4.0：每个 Skill 都有独立版本、生命周期（draft/active/deprecated/archived）、7/30 天频次、按 agent 聚合次数与合并档案；scan/doctor/use/stats/problems/CLI 状态灯/仓库关系图/只读网页继续可用，`npm test` 9/9。版本 diff/快照/打包在市场阶段前按需在本仓迭代，不回灌 CS。

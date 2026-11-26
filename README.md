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
skillhub stats --json
skillhub serve --port 4319            # http://127.0.0.1:4319
```

## 命令
| 命令 | 用途 |
|---|---|
| `scan` | Skill 清单/分类/来源，`--json` |
| `doctor` | 坏 frontmatter + 自管无版本，退出码 1 表示有问题 |
| `use <skill> --outcome ...` | 记一次使用（success/partial/failed） |
| `stats` / `problems` | 次数、成功率、最近使用、问题清单，`--skill` 过滤 |
| `serve` | 只读网页，端点 `/api/scan` `/api/doctor` `/api/stats` `/api/refresh` |

`SKILLHUB_DATA_DIR` 可改 SQLite 位置；`--root` 可改扫描根（可重复）。

## 文档
- [ADR-001 技术决策](docs/adr-001-tech-stack.md)：为什么保持轻量栈、CS 为什么只做消费端。
- [CS 集成契约](docs/cs-integration.md)：薄消费边界与接入方式。
- [SKILL.md](SKILL.md)：给 Agent 的用法说明。

## 状态
0.2.0：scan/doctor/use/stats/problems/只读网页全部可用，`npm test` 5/5。版本/diff/快照/打包在市场阶段前按需在本仓迭代，不回灌 CS。

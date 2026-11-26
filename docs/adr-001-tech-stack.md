# ADR-001：Skills 能力下放独立仓，CS 只做薄消费端

- 状态：Accepted（2026-11-26，同日推翻并重符合原方向）
- 范围：独立仓 `skillhub` + CS 插件接入
- 关键约束（owner 明确）：**CS 系统不能又大又重；Skills 这个任务下放给独立仓处理，CS 能读能用即可。**

## 背景

最初方案把 SkillHub 建在 CS 的 `cs skill` 与 `cs-ui-web /#/skills` 之上，并沿用 CS 的遥测真源（`cs_private.skill_usage`）与写命令。这与 owner 定的分层相反：CS 应保持轻量，不承担 Skills 的管理复杂度。

独立仓 `~/dev/agent-infra/skillhub` 已是 Skills 能力的**唯一真源**：scan/doctor/网页/遥测/统计都由它维护。CS 侧只保留一个薄插件，能读、能用，不复制管理逻辑、不做真源。

## 决策

| 职责 | 归属 | 说明 |
|---|---|---|
| Skill 索引 / 扫描 / 健康 | skillhub | `scan`、`doctor`，Git + Markdown 是源 |
| 使用统计 / 遥测 | skillhub | 本地 SQLite（`node:sqlite`，零外部依赖），不写 CS Supabase |
| 版本 / diff / 快照 / 打包 | skillhub | 后续迭代在独立仓实现；不委托 `cs skill` 作为真源 |
| CLI + Web | skillhub | Node+TS 共享 `src/types.ts`；`node:http` 只读 API |
| CS 系统 | 薄消费端 | 只留一个可读可用的插件 Skill，指向 skillhub；**不承载管理逻辑** |

### 明确不做

- skillhub 不依赖 CS 的 `cs skill` 体系作为真源或写入口。
- 不把 Skill 管理命令栈（bump/diff/snapshot/telemetry）塞进 CS。
- 不建 CS Supabase 与 skillhub SQLite 双遥测真源；遥测真源只在 skillhub。

## 权衡

- 获得：CS 保持轻量；Skills 能力在一个独立仓里迭代，发布节奏与 CS 解耦；遥测本地可读、零联网。
- 代价：CS 侧已有 `cs skill` 命令与 `/#/skills` 看板成为历史资产，短期并存，需明确「只读消费」定位避免混淆；独立仓要自己补齐原本 CS 提供的版本/打包能力。

## 推翻条件

1. CS 决定重新内聚 Skills 管理（与「CS 要轻」的约束冲突，需 owner 明确改口）。
2. 需要跨机/多人共享遥测，本地 SQLite 无法满足（此时引入 libSQL/Turso 作为独立仓的自有远端，仍不回 CS）。
3. 管理接口规模与交互复杂度使轻量栈维护成本反超框架（再评估 Next/Hono）。

## 证据

- owner 口径（2026-11-26）：「cs 系统不能又大又重，cs 系统把 Skills 这个任务下放处理，能读能用就好」。
- 独立仓现状：`npm run build`、`npm test` 通过；`scan`/`doctor`、本地网页四端点实测 200。

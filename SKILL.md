---
name: skillhub
version: "1.0.0"
description: "本地 SkillHub 独立 CLI：扫描/健康/统计/遥测/每 Skill 版本与生命周期/开源闭源口径/只读网页，Skills 管理真源，CS 只做薄消费。触发条件：用户要盘点/统计本机 Skills、记录某次使用结果、查版本欠账与格式损坏、查 Skill 生命周期与频次、把 Skill 标记为开源或闭源、启动本地 SkillHub 网页。触发词：skillhub、技能中心、技能盘点、技能统计、技能 doctor、技能生命周期、技能频次、开源闭源、记录 skill 使用。"
license: MIT
author: webkubor
category: devops
platforms: [linux, macos]
metadata:
  openclaw:
    tags: [skillhub, skills, cli, inventory, stats, telemetry]
    requires:
      bins: [skillhub]
      env: []
---

# skillhub CLI

## 概述

`skillhub` 是 Skills 能力的**独立真源**：扫描、健康、遥测、统计、只读网页都在这个仓里维护。CS 只做薄消费（能读能用），不承载管理逻辑。Skill 正文仍在各自源仓的 `SKILL.md`，hub 只做索引，不复制正文。

## 快速开始

```bash
npm install
npm run build
skillhub scan --json
skillhub doctor
skillhub use <skill> --outcome success --agent <id>
skillhub profile <skill> --json
skillhub stats --json
skillhub serve --port 4319
```

默认扫描多个已安装根；`--root <dir>` 可覆盖（可重复）。遥测写入本地 SQLite（`SKILLHUB_DATA_DIR` 可改），**不写 CS Supabase**。

## 命令

- `scan`：Skill 清单、分类、来源分布；`--json` 给网页/程序消费。
- `doctor`：坏 frontmatter + 自管无版本；有问题退出码 1。
- `use <skill> --outcome success|partial|failed [--agent] [--session] [--problem]`：记一次使用；success 不能带 problem。
- `stats` / `problems`：按 skill 统计次数、成功率、最近使用与问题清单；`--skill` 过滤，`--json` 输出。
- `frequency [days] [--skill] [--json]`：近 N 天频次与调用 agent 数，默认 7 天。
- `agents [--skill] [--json]`：按 skill + agent 聚合使用次数。
- `profile [<skill>] [--json]`：输出每个 Skill 的版本、生命周期、总次数、7/30 天频次、agent 分布和最近使用时间。
- `lifecycle <skill> <draft|active|deprecated|archived> [--note]`：登记 Skill 生命周期；未登记的 Skill 在档案中默认 active。
- `visibility <skill> open|closed [--note]`：登记本地开源/闭源口径；不自动改 GitHub 可见性、LICENSE 或支付宝商品配置。已公开历史版本和已发放许可证不能靠此收回。
- `status [--json]`：本机 gh/glab CLI 登录状态小灯，逐个 host 显示 🟢/🔴/🟡/⚪（glab 多 host 分别显示）。
- `relations [--json]`：Skill ↔ 仓库关系图——git remote 优先、frontmatter URL 回退；用 gh 当前账户的公开仓列表校准，命中公开仓=自有开源、同名账户私有仓=自有私有、其他 owner=第三方、匹配不到=未关联。输出 own-public / own-private / third-party / unlinked 四组。
- `serve`：本地网页（`127.0.0.1:4319`），含清单、doctor、CLI 状态灯、仓库关系、Skill 档案和统计表；档案表可切换开源/闭源（只写本地 SQLite）。端点 `/api/scan`、`/api/doctor`、`/api/stats`、`/api/status`、`/api/relations`、`/api/profiles`、`/api/refresh`、`POST /api/visibility`。

## 边界

- 遥测真源只在 skillhub 的本地 SQLite；不建第二份（CS Supabase 那套与本仓无关）。
- 网页默认只读；`POST /api/visibility` 只写本地 SQLite 的来源口径，不安装、不发布到外部市场。
- 来源口径不自动改 GitHub 可见性、LICENSE 或支付宝商品配置；已公开历史版本和已发放许可证不能靠此收回。
- 版本/diff/快照/打包由独立仓按自己的路线迭代；不从 `cs skill` 迁移，也不兼容 `cs skill` 命令栈。

## 相关

- CS 插件入口：`integrations/cs/skillhub-ops/SKILL.md`（薄消费端）。
- 技术决策：`docs/adr-001-tech-stack.md`。

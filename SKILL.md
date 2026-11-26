---
name: skillhub
version: "0.3.0"
description: "本地 SkillHub 独立 CLI：扫描/健康/统计/遥测/只读网页，Skills 管理真源，CS 只做薄消费。触发条件：用户要盘点/统计本机 Skills、记录某次使用结果、查版本欠账与格式损坏、启动本地 SkillHub 网页。触发词：skillhub、技能中心、技能盘点、技能统计、技能 doctor、记录 skill 使用。"
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
skillhub stats --json
skillhub serve --port 4319
```

默认扫描多个已安装根；`--root <dir>` 可覆盖（可重复）。遥测写入本地 SQLite（`SKILLHUB_DATA_DIR` 可改），**不写 CS Supabase**。

## 命令

- `scan`：Skill 清单、分类、来源分布；`--json` 给网页/程序消费。
- `doctor`：坏 frontmatter + 自管无版本；有问题退出码 1。
- `use <skill> --outcome success|partial|failed [--agent] [--session] [--problem]`：记一次使用；success 不能带 problem。
- `stats` / `problems`：按 skill 统计次数、成功率、最近使用与问题清单；`--skill` 过滤，`--json` 输出。
- `status [--json]`：本机 gh/glab CLI 登录状态小灯，逐个 host 显示 🟢/🔴/🟡/⚪（glab 多 host 分别显示）。
- `relations [--json]`：Skill ↔ 仓库关系图——先用 gh 当前账户匹配自有开源（GitHub/GitLab 同名 owner 算自有），再按 git remote / frontmatter URL 认第三方；输出 own / third-party / unlinked 三组。
- `serve`：只读本地网页（`127.0.0.1:4319`），含清单、doctor、CLI 状态灯、仓库关系和统计表，端点 `/api/scan`、`/api/doctor`、`/api/stats`、`/api/status`、`/api/relations`、`/api/refresh`。

## 边界

- 遥测真源只在 skillhub 的本地 SQLite；不建第二份（CS Supabase 那套与本仓无关）。
- 网页只读；不写 `SKILL.md`、不安装、不发布到外部市场。
- 版本/diff/快照/打包在独立仓后续迭代实现，不依赖 CS 命令栈。

## 相关

- CS 插件入口：`integrations/cs/skillhub-ops/SKILL.md`（薄消费端）。
- 技术决策：`docs/adr-001-tech-stack.md`。

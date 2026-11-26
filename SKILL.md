---
name: skillhub
version: "0.1.0"
description: "本地 SkillHub 的独立 CLI 使用说明：扫描、统计、doctor 与只读网页。触发条件：用户要盘点/统计本机 Skills、检查版本与格式健康、启动本地 SkillHub 网页；分发/安装/打包仍走 cs skill。触发词：skillhub、技能盘点、技能统计、技能 doctor、本地技能网页。"
license: MIT
author: webkubor
category: devops
platforms: [linux, macos]
metadata:
  openclaw:
    tags: [skillhub, skills, cli, inventory, stats]
    requires:
      bins: [node]
      env: []
---

# skillhub CLI

## 概述

`skillhub` 是独立维护的 Skill 索引与健康检查工具。CS 通过 `skillhub-ops` 插件 Skill 间接使用它；**Skill 真源仍在各源仓，写操作仍走 `cs skill`**。

## 快速开始

```bash
npm install
npm run build
node dist/cli.js scan --json
node dist/cli.js doctor
node dist/cli.js serve --port 4319
```

默认扫描根：`~/dev/cs/CortexOS/skills`；可用多个 `--root <dir>` 覆盖。

## 命令

- `scan`：输出 Skill 清单、分类、来源分布；`--json` 给网页或程序消费。
- `doctor`：列出格式损坏、自管无版本技能；有问题的退出码为 1。
- `serve`：启动只读本地网页（默认 `127.0.0.1:4319`），提供 `/api/scan`、`/api/doctor`、`/api/refresh`。

## 边界

- 只读：不修改 `SKILL.md`，不安装，不发布。
- 公司技能不打包；第三方技能只登记来源、不补版本。
- 外部发布（小红书 SkillHub）不在本工具默认能力内。

## 相关

- CS 插件：`cs skill show skillhub-ops`
- 写操作：`cs skill install/bump/pack/validate/eval`

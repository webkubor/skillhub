---
name: skillhub-ops
version: "0.2.0"
description: "本地 SkillHub 的 CS 插件薄入口：用独立 skillhub CLI 做盘点/统计/doctor/网页，写操作仍委托 cs skill。触发条件：用户要盘点/统计本机 Skills、查版本欠账与格式损坏、启动本地 SkillHub 网页。触发词：skillhub、技能中心、技能盘点、技能统计、技能 doctor、本地技能网页。与小红书 SkillHub 发布（museav skillhub publish）无关。"
license: MIT
author: webkubor
category: devops
platforms: [linux, macos]
metadata:
  openclaw:
    tags: [skillhub, skills, plugin, cs]
    requires:
      bins: [skillhub, cs]
      env: []
    related_skills: [run-coordination, release-sync]
---

# SkillHub 运维（CS 插件薄入口）

## 概述

本 Skill 是 CS 对独立仓库 `skillhub` 的**薄适配**：SkillHub 的真源、CLI、网页都由独立仓 `~/dev/agent-infra/skillhub` 维护，CS 只在这里指路，**不复制规则正文、不持有 Skill 真源副本**。

## 读：用独立 CLI

```bash
skillhub scan --json                 # 盘点：清单/分类/来源
skillhub doctor                      # 健康：坏 frontmatter + 自管无版本
skillhub serve --port 4319           # 只读网页 http://127.0.0.1:4319
```

默认扫描根 `~/dev/cs/CortexOS/skills`，可用多个 `--root` 覆盖。网页只读，端点 `/api/scan`、`/api/doctor`、`/api/refresh`。

## 写：仍走 CS 原生命令

skillhub 不做写操作。以下动作一律用 `cs skill`：

```bash
cs skill snapshot <name>
cs skill bump <name> patch --write
cs skill install <name> && cs skill install --check
cs skill validate <name> && cs skill eval <name>
cs skill pack <name>
```

公司技能（`scope: company`）不打包、不发布；第三方（`origin: opensource:*`）不补版本。外部发布（小红书 SkillHub）不在本插件能力内。

## 边界

- 本插件只是入口；实现与版本在独立仓 `~/dev/agent-infra/skillhub`（`docs/cs-integration.md` 是契约）。
- 需要先 `skillhub install`（独立仓 `install.sh`）把 CLI 装到 `~/.local/bin`。
- 详细流程见独立仓 `SKILL.md`，不在这里复制。

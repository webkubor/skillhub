---
name: skillhub-ops
version: "0.3.0"
description: "CS 侧的 SkillHub 薄消费入口：能读能用 skillhub 的清单、健康、统计与网页，不在 CS 承载 Skills 管理逻辑。触发条件：用户要盘点/统计本机 Skills、查格式健康、看使用统计、启动本地 SkillHub 网页。触发词：skillhub、技能盘点、技能统计、技能 doctor、本地技能网页。管理实现在独立仓，不在 CS。"
license: MIT
author: webkubor
category: devops
platforms: [linux, macos]
metadata:
  openclaw:
    tags: [skillhub, cs-plugin, consumer]
    requires:
      bins: [skillhub]
      env: []
---

# SkillHub（CS 薄消费端）

## 定位

CS 保持轻量。Skills 的管理真源在**独立仓** `~/dev/agent-infra/skillhub`；本插件只是让 CS 里的 Agent **能读能用** skillhub，不复制管理逻辑、不做第二真源。

## 能读能用

```bash
skillhub scan --json              # 清单/分类/来源
skillhub doctor                   # 格式健康
skillhub stats --json             # 使用统计
skillhub use <skill> --outcome success|partial|failed   # 记一次使用
skillhub serve --port 4319        # 只读网页
```

首次需要 `skillhub install`（独立仓 `install.sh`）把 CLI 装到 `~/.local/bin`。

## 边界

- 不把 Skills 管理命令（bump/diff/snapshot/pack/telemetry）塞进 CS。
- 遥测真源是 skillhub 的本地 SQLite，不写 CS Supabase。
- 实现细节与版本以独立仓 `SKILL.md` / `docs/adr-001-tech-stack.md` 为准，此处不复述。

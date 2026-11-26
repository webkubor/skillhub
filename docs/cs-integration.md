# CS 集成契约（薄消费端）

## 原则

**CS 不做 Skills 管理平台。** 独立仓 `skillhub` 是 Skills 能力的唯一真源；CS 只保留一个薄插件，做到「能读能用」。

## 边界

| 归属 | 职责 |
|---|---|
| skillhub 独立仓 | scan / doctor / 遥测 SQLite / stats / 只读网页 / 后续版本与打包能力 |
| CS（本仓 `integrations/cs/`） | 一个薄 Skill 入口，调用已安装的 `skillhub` CLI |

CS **不**：复制 skillhub 规则正文、持有 Skill 真源副本、承接管理命令栈、写第二份遥测。

## 接入

1. `./install.sh`（独立仓）把入口装到 `~/.local/bin/skillhub`。
2. CS 侧插件 `integrations/cs/skillhub-ops/SKILL.md` 只教 Agent 何时调 `skillhub scan/doctor/stats/use/serve`。
3. 数据契约见 `src/types.ts`；网页端点 `/api/scan`、`/api/doctor`、`/api/stats`、`/api/refresh`。

## 版本

`package.json` 与 `SKILL.md` frontmatter 同步 SemVer。CS 插件版本独立（薄入口，随独立仓发布节奏走）。

## 门禁

- 改动独立仓必跑 `npm run build` + `npm test`。
- 网页只读，不写 `SKILL.md`、不安装、不发布。

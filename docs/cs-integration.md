# CS 集成契约（薄消费端）

## 原则

**CS 不直接参与 Skills 管理。** 独立仓 `skillhub` 是 Skills 能力的唯一真源和唯一管理入口。CS 最多提供一个薄入口，让人/Agent 能读能用；CS 旧 `cs skill` 管理命令不是迁移源、不是兼容目标、不在本仓路线图内。

## 边界

| 归属 | 职责 |
|---|---|
| skillhub 独立仓 | scan / doctor / 遥测 SQLite / stats / 只读网页 / 后续版本与打包能力 |
| CS（本仓 `integrations/cs/`） | 一个薄 Skill 入口，调用已安装的 `skillhub` CLI |

CS **不**：复制 skillhub 规则正文、持有 Skill 真源副本、承接任何管理命令栈、写第二份遥测、作为能力迁移源或兼容目标。

## 接入

1. `./install.sh`（独立仓）把入口装到 `~/.local/bin/skillhub`。
2. CS 侧插件 `integrations/cs/skillhub-ops/SKILL.md` 只教 Agent 何时调 `skillhub scan/doctor/audit/stats/use/serve`。
3. 该插件是 CS 侧**唯一**副本：CS 的 `var/skill-roots.txt` 注册根指向
   `~/dev/agent-infra/skillhub/integrations/cs`，`cs skill install` 把 9 个运行时软链到这里。
   CS 仓内不再保留同名正文或评测集（2026-11-27 迁出，CortexOS `8c1f9dd7`）。
4. 数据契约见 `src/types.ts`；网页端点 `/api/scan`、`/api/doctor`、`/api/stats`、`/api/refresh`。

## 版本

`package.json` 与 `SKILL.md` frontmatter 同步 SemVer。CS 插件版本独立（薄入口，随独立仓发布节奏走）。

## 门禁

- 改动独立仓必跑 `npm run build` + `npm test`。
- 网页只读，不写 `SKILL.md`、不安装、不发布。

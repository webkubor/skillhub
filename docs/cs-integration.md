# CS 集成契约

## 原则

skillhub 是独立仓库；CS 只做插件接入，**不复制规则正文、不持有 Skill 真源副本**。

## 接入方式

1. CS 侧薄 Skill：`skills/devops/skillhub-ops/SKILL.md` 指向本仓库 `skillhub` CLI。当前版本保留 CS 命令流程作为兼容入口。
2. 运行时链接：`skillhub install`（本仓库 `install.sh`）在 `~/.local/bin` 写入指向 `dist/cli.js` 的入口；网页服务默认 `127.0.0.1:4319`。
3. 数据契约：网页与 CLI 共享 `/api/scan`、`/api/doctor`、`/api/refresh` JSON；字段见 `src/types.ts`。
4. 写操作：安装、bump、pack、validate、eval 仍走 `cs skill ...`；本仓库只读。

## 版本与发布

- 本仓 SemVer 由 `package.json` 与 `SKILL.md` frontmatter 同步；发布时按 `cs rule release-semantics`。
- 外部 SkillHub（小红书）发布不在本仓默认能力内，属于另有授权的外部副作用。

## 门禁

- 改动必须跑 `npm run build` + `npm test`。
- 网页只能读/刷新扫描缓存，不得写 `SKILL.md` 或运行时目录。

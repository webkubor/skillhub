# AGENTS.md — skillhub

## 这是什么

独立仓库维护的本地 SkillHub：扫描、统计、doctor、只读网页。CS / cs-ui-web 作为插件消费，不持有 Skill 真源副本。

## 关键文件

- `src/scan.ts`：扫描与 frontmatter 解析（无第三方依赖）。
- `src/cli.ts`：CLI 与本地只读网页。
- `SKILL.md`：给 Agent 的接入说明（CS 插件薄入口）。
- `test/`：node:test 测试。

## 常用命令

```bash
npm install
npm run build
npm test
node dist/cli.js scan --json
node dist/cli.js doctor
```

## 红线

- 不复制 Skill 正文进本仓库，只保存索引与元数据。
- 网页只读；写操作委托 `cs skill`（安装、bump、pack）。
- 公司技能（`scope: company`）与第三方（`origin: opensource:*`）不打包、不替上游管版本。
- 不扫码授权、不对外发布；外部 SkillHub 发布不在本仓库默认能力内。

# AGENTS.md — skillhub

## 这是什么

独立仓库维护的本地 SkillHub：扫描、统计、doctor、本地管理网页。CS 不直接参与 Skills 管理，也不作为本仓的迁移源；只允许薄入口能读能用。

## 关键文件

- `src/scan.ts`：扫描与 frontmatter 解析（无第三方依赖）。
- `src/cli.ts`：CLI 与本地网页服务。
- `src/web.ts`：本地网页与 API。
- `src/usage.ts`：本地 SQLite：使用记录、生命周期、来源可见性。
- `src/profile.ts`：每个 Skill 的版本、生命周期、来源、频次、agent 聚合档案。
- `DESIGN.md`：本地网页设计契约；改 UI 前先读。
- `SKILL.md`：给 Agent 的接入说明（CS 插件薄入口）。
- `test/`：node:test 测试。

## 常用命令

```bash
npm install
npm run build
npm test
node dist/cli.js scan --json
node dist/cli.js doctor
node dist/cli.js profile --json
```

## 红线

- 不复制 Skill 正文进本仓库，只保存索引与元数据。
- 网页默认只读；当前唯一例外是 `POST /api/visibility`，只写本地 SQLite 的来源口径。
- 来源口径 `open|closed` 不自动改 GitHub 可见性、LICENSE 或支付宝商品配置；已公开历史版本和已发放许可证不能靠页面开关收回。
- 公司技能（`scope: company`）与第三方（`origin: opensource:*`）不打包、不替上游管版本。
- 不扫码授权、不对外发布；外部 SkillHub 发布不在本仓库默认能力内。

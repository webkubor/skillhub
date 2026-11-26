# 线上 Skill 分发平台清单

> 记录于 2026-11-26。仅登记，不代表已接入。skillhub 本地仓当前只做本机闭环，外部发布属于另有授权的外部副作用。

| 平台 | URL | 归属 | 状态 |
|---|---|---|---|
| SkillHub | https://skillhub.cn/ | 腾讯云 | 📝 已记录，未接入 |
| SkillPay | https://skillpay.alipay.com/ | 支付宝 | 📝 已记录，未接入 |

## 说明

- 这两个是**线上分发/交易**平台，与本地 `skillhub` CLI 是不同层次：本地仓负责扫描/健康/遥测/统计，平台负责对外分发。
- 接入判断按 ADR-001 的推翻条件：只有当 SkillHub 要对外提供市场（多人、租户、计费、权限）时才评估对接；届时应以各平台官方 CLI/协议为准，不自建协议。
- 已有的另一条外部发布路径：`museav skillhub publish`（小红书 SkillHub，走上游 `redskillhub-upload`），同样是外部副作用，不默认执行。

## 待补（接入前置调研，非当前任务）

- [ ] 各平台是否有官方上传 CLI / OpenAPI，认证方式（设备码 / API Key）。
- [ ] Skill 包格式是否兼容 `.skill` 归档（CS `skill pack` / 本地仓后续打包）。
- [ ] 平台侧 Skill ID 是否提交后不可变（小红书那条链路有此约束）。
- [ ] 归属声明与原创/转载标记要求。

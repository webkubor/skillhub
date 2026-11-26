# skillhub

本机 Skill 的独立仓库：扫描、统计、分发、迭代门禁与网页视图。CS / cs-ui-web 只作为插件消费本仓库的能力，不把 Skill 真源搬进 CS。

## 定位
- 真源仍是各源仓的 `SKILL.md`；skillhub 是索引与门禁层，不持有 Skill 正文副本。
- CLI 是第一入口，网页只读 + dry-run；写操作委托现有 `cs skill`。
- 公司技能（`scope: company`）永不发布；第三方技能只登记来源、不替上游管版本。

## 快速开始
```bash
npm install
npm run build
node dist/cli.js scan --root ~/dev/cs/CortexOS/skills --json
node dist/cli.js doctor --root ~/dev/cs/CortexOS/skills
node dist/cli.js serve --root ~/dev/cs/CortexOS/skills --port 4319
```

## 插件接入
CS 侧只放一个薄 Skill：`skills/devops/skillhub-ops/SKILL.md`，指向本仓库 CLI；不复制规则正文、不另建数据库。

## 状态
0.1.0：扫描、统计、doctor、只读网页。分发/打包/发布门禁继续委托 `cs skill pack` / `cs skill install`，外部发布不默认开启。

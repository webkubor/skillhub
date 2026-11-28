#!/usr/bin/env bash
# skillhub 本地开发安装器：把当前源码链接到 ~/.local/bin/skillhub。
# 实际发布时可按平台打包成独立二进制；本脚本只服务本机开发接入。
#
# 同时把 CS 侧薄入口注册到 CortexOS 的本地 skill 注册表（var/skill-roots.txt）。
# 那文件在 .gitignore 里、是纯本地状态，换机后必然为空 —— 注册动作放在这里，
# 换机跑一次 ./install.sh 就能恢复，不必靠记忆手抄路径。
# 不想动 CS 注册表：SKILLHUB_SKIP_CS_REGISTER=1 ./install.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${SKILLHUB_INSTALL_DIR:-$HOME/.local/bin}"

if [ ! -f "$REPO_DIR/dist/cli.js" ]; then
  echo "dist/cli.js not found; run: npm install && npm run build" >&2
  exit 1
fi

# --help 加载真实 CLI 的模块，但不会打开统计库。已有依赖能启动就不重装。
if ! node "$REPO_DIR/dist/cli.js" --help >/dev/null; then
  echo "CLI startup failed; restoring dependencies from package-lock.json with npm ci" >&2
  (cd "$REPO_DIR" && npm ci)
  node "$REPO_DIR/dist/cli.js" --help >/dev/null
fi

mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/skillhub" <<EOF
#!/usr/bin/env bash
exec node "$REPO_DIR/dist/cli.js" "\$@"
EOF
chmod +x "$INSTALL_DIR/skillhub"
echo "installed: $INSTALL_DIR/skillhub -> $REPO_DIR/dist/cli.js"

# ── CS 薄入口注册（幂等）───────────────────────────────────────────────
if [ "${SKILLHUB_SKIP_CS_REGISTER:-0}" != "1" ]; then
  CS_ROOT="${CORTEXOS_DIR:-$HOME/dev/cs/CortexOS}"
  REGISTRY="$CS_ROOT/var/skill-roots.txt"
  TARGET="$REPO_DIR/integrations/cs"

  if [ -d "$CS_ROOT" ] && [ -d "$TARGET" ]; then
    mkdir -p "$(dirname "$REGISTRY")"
    touch "$REGISTRY"
    # 已注册就不重复追加。注册表里可能写 ~/... 或绝对路径，按解析后的真实
    # 路径比较，否则同一目录会被当成两条（实测踩过）。
    TARGET_REAL="$(cd "$TARGET" && pwd -P)"
    already=""
    while IFS= read -r line; do
      case "$line" in
        ''|'#'*) continue ;;
      esac
      expanded="${line/#\~/$HOME}"
      if [ -d "$expanded" ]; then
        if [ "$(cd "$expanded" && pwd -P)" = "$TARGET_REAL" ]; then
          already="yes"
          break
        fi
      fi
    done < "$REGISTRY"

    if [ -n "$already" ]; then
      echo "cs register: already present ($TARGET)"
    else
      {
        echo ''
        echo '# ── SkillHub 集成插件（CS 薄消费入口的唯一真源；由 skillhub ./install.sh 幂等写入）──'
        echo "$TARGET"
      } >> "$REGISTRY"
      echo "cs register: appended $TARGET -> $REGISTRY"
    fi
    echo "next: cs skill install skillhub-ops   # 把入口铺到各运行时"
  else
    echo "cs register: skipped (missing $CS_ROOT or $TARGET)"
  fi
fi

#!/usr/bin/env bash
# skillhub 本地开发安装器：把当前源码链接到 ~/.local/bin/skillhub。
# 实际发布时可按平台打包成独立二进制；本脚本只服务本机开发接入。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${SKILLHUB_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR"

if [ ! -f "$REPO_DIR/dist/cli.js" ]; then
  echo "dist/cli.js not found; run: npm install && npm run build" >&2
  exit 1
fi

cat > "$INSTALL_DIR/skillhub" <<EOF
#!/usr/bin/env bash
exec node "$REPO_DIR/dist/cli.js" "\$@"
EOF
chmod +x "$INSTALL_DIR/skillhub"
echo "installed: $INSTALL_DIR/skillhub -> $REPO_DIR/dist/cli.js"

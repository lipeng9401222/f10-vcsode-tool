#!/usr/bin/env bash
# F10 一键环境安装脚本（macOS / Linux）
# 参考：vue-docs-for-ai-main/vue-docs/getting-started/getting-started-full-process-experience.md
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.21.1}"
EPOINT_REGISTRY="${EPOINT_REGISTRY:-http://192.168.0.99:8081/nexus/repository/npmpublic/}"

echo "=== [1/7] 安装 nvm（如未安装）==="
if ! command -v nvm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
if ! command -v nvm >/dev/null 2>&1; then
  echo "[ERROR] nvm 未安装成功，请参考 https://github.com/nvm-sh/nvm 手动安装" >&2
  exit 1
fi

echo "=== [2/7] 设置 nvm 国内镜像 ==="
export NVM_NODEJS_ORG_MIRROR="https://npmmirror.com/mirrors/node"

echo "=== [3/7] 安装并使用 Node.js ${NODE_VERSION} ==="
nvm install "${NODE_VERSION}"
nvm use "${NODE_VERSION}"
nvm alias default "${NODE_VERSION}"

echo "=== [4/7] 安装 nrm 并切换到公司私有源 ==="
npm install -g nrm --registry=https://registry.npmmirror.com
if ! nrm ls | grep -q " epoint "; then
  nrm add epoint "${EPOINT_REGISTRY}" || true
fi
nrm use epoint

echo "=== [5/7] 写入 npm token 到用户 .npmrc ==="
NPMRC_PATH="$HOME/.npmrc"
NPM_TOKEN="${NPM_TOKEN:-}"
if [ -z "$NPM_TOKEN" ]; then
  echo "[ERROR] 请设置环境变量 NPM_TOKEN（npm 私有源认证令牌）" >&2
  exit 1
fi
TOKEN_LINE="//192.168.0.99:8081/nexus/repository/npmpublic/:_authToken=${NPM_TOKEN}"
PREFIX_PATTERN='^//192\.168\.0\.99:8081/nexus/repository/npmpublic/:_authToken=.*$'
if [ -f "$NPMRC_PATH" ]; then
  grep -Ev "$PREFIX_PATTERN" "$NPMRC_PATH" > "${NPMRC_PATH}.tmp" || true
  printf "%s\n" "$TOKEN_LINE" >> "${NPMRC_PATH}.tmp"
  mv "${NPMRC_PATH}.tmp" "$NPMRC_PATH"
else
  printf "%s\n" "$TOKEN_LINE" > "$NPMRC_PATH"
fi

echo "=== [6/7] 安装 pnpm@10 ==="
npm install -g pnpm@10

echo "=== [7/7] 安装 @epframe/eui-cli ==="
npm install -g @epframe/eui-cli

echo
echo "✅ 全部完成。当前 Node 版本：$(node -v)"
echo "   pnpm 版本：$(pnpm -v 2>/dev/null || echo '需要重启终端')"

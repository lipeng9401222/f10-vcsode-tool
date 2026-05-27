#!/usr/bin/env bash
# F10 一键环境安装脚本（macOS / Linux）
# 参考：getting-started-development-environment.md
#
# 步骤：
#   1) 安装 nvm（如已存在则跳过）
#   2) 设置 nvm 国内镜像
#   3) 通过 nvm 安装并切换到指定 Node 版本（默认 22.21.1）
#   4) 全局安装 nrm（指定淘宝源避免私有源未配置时拉取失败）
#   5) 添加并切换到公司私有源 epoint
#   6) 全局安装 pnpm@10
#   7) 全局安装 @epframe/eui-cli
#   8) 提示用户执行 npm login（无法在脚本中非交互完成，需要输入用户名密码）
#
# 用法（VSCode 插件会自动设置）：
#   NODE_VERSION=22.21.1 EPOINT_REGISTRY=http://... bash install-env-mac.sh
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.21.1}"
EPOINT_REGISTRY="${EPOINT_REGISTRY:-http://192.168.0.99:8081/nexus/repository/npmpublic/}"

step() { echo -e "\n=== $* ==="; }

step "[1/8] 安装 nvm（如未安装）"
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
  echo "[ERROR] nvm 未安装成功，请参考 https://github.com/nvm-sh/nvm 手动安装后重试" >&2
  exit 1
fi

step "[2/8] 设置 nvm 国内镜像"
export NVM_NODEJS_ORG_MIRROR="https://npmmirror.com/mirrors/node"

step "[3/8] 安装并切换到 Node.js ${NODE_VERSION}"
nvm install "${NODE_VERSION}"
nvm use "${NODE_VERSION}"
nvm alias default "${NODE_VERSION}"

step "[4/8] 全局安装 nrm"
npm install -g nrm --registry=https://registry.npmmirror.com

step "[5/8] 添加并切换到 epoint 公司私有源"
# 已存在时 nrm add 会失败，忽略错误继续
nrm add epoint "${EPOINT_REGISTRY}" 2>/dev/null || true
nrm use epoint

step "[6/8] 全局安装 pnpm@10"
npm install -g pnpm@10

step "[7/8] 全局安装 @epframe/eui-cli"
npm install -g @epframe/eui-cli

step "[8/8] 完成"
echo "✅ Node:      $(node -v 2>/dev/null || echo '未生效，重启终端后再确认')"
echo "✅ pnpm:      $(pnpm -v 2>/dev/null || echo '未生效，重启终端后再确认')"
echo "✅ eui-cli:   $(eui-cli --version 2>/dev/null || echo '未生效，重启终端后再确认')"
echo
echo "👉 后续请在当前终端中执行：npm login"
echo "    用户名: epointfe"
echo "    密  码: 11111"
echo "    邮  箱: 随意填写"
echo "登录信息会保存在 ~/.npmrc，下次无需重复登录。"

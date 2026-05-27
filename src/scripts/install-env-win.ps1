# F10 一键环境安装脚本（Windows / PowerShell）
# 参考：getting-started-development-environment.md
#
# 步骤：
#   1) 安装 nvm-windows（如已存在则跳过；优先用 winget）
#   2) 设置 nvm 国内镜像
#   3) 通过 nvm 安装并切换到指定 Node 版本（默认 22.21.1）
#   4) 全局安装 nrm
#   5) 添加并切换到公司私有源 epoint
#   6) 全局安装 pnpm@10
#   7) 全局安装 @epframe/eui-cli
#   8) 提示用户执行 npm login（无法在脚本中非交互完成，需要输入用户名密码）
#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$nodeVersion = if ($env:NODE_VERSION) { $env:NODE_VERSION } else { "22.21.1" }
$epointRegistry = if ($env:EPOINT_REGISTRY) { $env:EPOINT_REGISTRY } else { "http://192.168.0.99:8081/nexus/repository/npmpublic/" }

function Ensure-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { return $false } else { return $true }
}

Write-Host "=== [1/8] 安装 nvm-windows（如未安装）==="
if (-not (Ensure-Command "nvm")) {
  if (Ensure-Command "winget") {
    winget install -e --id CoreyButler.NVMforWindows --silent --accept-package-agreements --accept-source-agreements | Out-Null
  } else {
    Write-Warning "未检测到 winget，请手动安装 nvm-windows: https://github.com/coreybutler/nvm-windows/releases"
  }
}
if (-not (Ensure-Command "nvm")) {
  $nvmPath = "$env:ProgramFiles\nvm"
  if (Test-Path $nvmPath) {
    $env:Path = "$env:Path;$nvmPath"
  }
}
if (-not (Ensure-Command "nvm")) {
  throw "nvm 未安装，无法继续。"
}

Write-Host "=== [2/8] 设置 nvm 国内镜像 ==="
nvm node_mirror https://npmmirror.com/mirrors/node/
nvm npm_mirror https://npmmirror.com/mirrors/npm/

Write-Host "=== [3/8] 安装并切换到 Node.js $nodeVersion ==="
nvm install $nodeVersion
nvm use $nodeVersion

Write-Host "=== [4/8] 全局安装 nrm ==="
npm install -g nrm --registry=https://registry.npmmirror.com

Write-Host "=== [5/8] 添加并切换到 epoint 公司私有源 ==="
try { nrm add epoint $epointRegistry } catch { }
nrm use epoint

Write-Host "=== [6/8] 全局安装 pnpm@10 ==="
npm install -g pnpm@10

Write-Host "=== [7/8] 全局安装 @epframe/eui-cli ==="
npm install -g @epframe/eui-cli

Write-Host "=== [8/8] 完成 ==="
Write-Host "✅ Node:    " -NoNewline; node -v
try { Write-Host "✅ pnpm:    " -NoNewline; pnpm -v } catch { Write-Host "未生效，重启终端后再确认" }
try { Write-Host "✅ eui-cli: " -NoNewline; eui-cli --version } catch { Write-Host "未生效，重启终端后再确认" }
Write-Host ""
Write-Host "👉 后续请在当前终端中执行：npm login"
Write-Host "   用户名: epointfe"
Write-Host "   密  码: 11111"
Write-Host "   邮  箱: 随意填写"
Write-Host "登录信息会保存在用户目录下的 .npmrc，下次无需重复登录。"

# F10 一键环境安装脚本（Windows / PowerShell）
# 参考：vue-docs-for-ai-main/vue-docs/getting-started/getting-started-full-process-experience.md
#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$nodeVersion = if ($env:NODE_VERSION) { $env:NODE_VERSION } else { "22.21.1" }
$epointRegistry = if ($env:EPOINT_REGISTRY) { $env:EPOINT_REGISTRY } else { "http://192.168.0.99:8081/nexus/repository/npmpublic/" }

function Ensure-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { return $false } else { return $true }
}

Write-Host "=== [1/7] 安装 nvm-windows（如未安装）==="
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

Write-Host "=== [2/7] 设置 nvm 国内镜像 ==="
nvm node_mirror https://npmmirror.com/mirrors/node/
nvm npm_mirror https://npmmirror.com/mirrors/npm/

Write-Host "=== [3/7] 安装并使用 Node.js $nodeVersion ==="
nvm install $nodeVersion
nvm use $nodeVersion

Write-Host "=== [4/7] 安装 nrm 并切换到公司私有源 ==="
npm install -g nrm --registry=https://registry.npmmirror.com
$nrmList = nrm ls
if ($nrmList -notmatch " epoint ") {
  try { nrm add epoint $epointRegistry } catch {}
}
nrm use epoint

Write-Host "=== [5/7] 写入 npm token 到用户 .npmrc ==="
$npmrcPath = Join-Path $env:USERPROFILE ".npmrc"
$npmToken = if ($env:NPM_TOKEN) { $env:NPM_TOKEN } else { $null }
if (-not $npmToken) {
  throw "请设置环境变量 NPM_TOKEN（npm 私有源认证令牌）"
}
$tokenLine = "//192.168.0.99:8081/nexus/repository/npmpublic/:_authToken=$npmToken"
$prefixPattern = "^//192\.168\.0\.99:8081/nexus/repository/npmpublic/:_authToken=.*$"
if (Test-Path $npmrcPath) {
  $lines = Get-Content -Path $npmrcPath -ErrorAction SilentlyContinue
  $filtered = @()
  foreach ($line in $lines) {
    if ($line -match $prefixPattern) { continue } else { $filtered += $line }
  }
  $filtered + $tokenLine | Set-Content -Path $npmrcPath -Encoding UTF8
} else {
  Set-Content -Path $npmrcPath -Value $tokenLine -Encoding UTF8
}

Write-Host "=== [6/7] 安装 pnpm@10 ==="
npm install -g pnpm@10

Write-Host "=== [7/7] 安装 @epframe/eui-cli ==="
npm install -g @epframe/eui-cli

Write-Host ""
Write-Host "✅ 全部完成。当前 Node 版本：" -NoNewline; node -v

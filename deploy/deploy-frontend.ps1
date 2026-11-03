# ============================================================
# 学迹 StudyFlow - 前端一键部署脚本
# 用法:
#   .\deploy-frontend.ps1 -ServerIP 123.45.67.89 [-User root] [-Key "C:\Users\你\.ssh\studyflow_deploy"] [-Rebuild]
# 前置条件:
#   1. 已用公钥在华为云创建 ECS(Ubuntu)，安全组放行 22/80
#   2. 服务器已装 nginx 且 /var/www/studyflow 目录存在(脚本会自动创建)
# ============================================================
param(
    [Parameter(Mandatory = $true)][string]$ServerIP,
    [string]$User = "root",
    [string]$Key = "$env:USERPROFILE\.ssh\studyflow_deploy",
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"
$dist = Join-Path $frontend "dist"
$target = "/var/www/studyflow"

# 1. 构建(按需)
if ($Rebuild -or -not (Test-Path (Join-Path $dist "index.html"))) {
    Write-Host "[1/4] 构建前端..." -ForegroundColor Cyan
    Push-Location $frontend
    npm run build
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }
    Pop-Location
} else {
    Write-Host "[1/4] dist/ 已存在，跳过构建(加 -Rebuild 强制重建)" -ForegroundColor Cyan
}

# 2. 打包
Write-Host "[2/4] 打包 dist..." -ForegroundColor Cyan
$tarFile = Join-Path $env:TEMP "studyflow-dist.tar.gz"
Push-Location $dist
tar -czf $tarFile .
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }
Pop-Location

# 3. 上传
Write-Host "[3/4] 上传到 $User@$ServerIP ..." -ForegroundColor Cyan
ssh -i $Key -o StrictHostKeyChecking=accept-new "$User@$ServerIP" "mkdir -p $target"
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }
scp -i $Key -o StrictHostKeyChecking=accept-new $tarFile "$User@$ServerIP":/tmp/studyflow-dist.tar.gz
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }

# 4. 解压 + 初始化 nginx
Write-Host "[4/4] 服务器端解压并配置 nginx..." -ForegroundColor Cyan
$remote = @"
set -e
mkdir -p $target/dist
tar -xzf /tmp/studyflow-dist.tar.gz -C $target/dist
rm -f /tmp/studyflow-dist.tar.gz
if ! command -v nginx >/dev/null; then
  apt-get update -y && apt-get install -y nginx
fi
"@
ssh -i $Key -o StrictHostKeyChecking=accept-new "$User@$ServerIP" $remote
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }

Write-Host ""
Write-Host "✅ 前端已部署! 浏览器访问 http://$ServerIP 即可" -ForegroundColor Green
Write-Host "   注意: 还需把 deploy/studyflow-nginx.conf 放到服务器 /etc/nginx/conf.d/ 并 reload，"
Write-Host "         或运行 deploy-backend.ps1 的 -SetupNginx 步骤。"

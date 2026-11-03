# ============================================================
# 学迹 StudyFlow - 后端 + Nginx 一键部署脚本
# 用法:
#   .\deploy-backend.ps1 -ServerIP 123.45.67.89 [-User root] [-Key "C:\Users\你\.ssh\studyflow_deploy"] [-SetupNginx]
# 前置条件: 前端已按 deploy-frontend.ps1 部署(或同一次执行)
# ============================================================
param(
    [Parameter(Mandatory = $true)][string]$ServerIP,
    [string]$User = "root",
    [string]$Key = "$env:USERPROFILE\.ssh\studyflow_deploy",
    [switch]$SetupNginx
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$target = "/var/www/studyflow"

# 1. 打包后端
Write-Host "[1/4] 打包 backend..." -ForegroundColor Cyan
$tarFile = Join-Path $env:TEMP "studyflow-backend.tar.gz"
Push-Location $backend
tar -czf $tarFile --exclude=venv --exclude=.venv --exclude=.env --exclude=__pycache__ --exclude=*.db .
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }
Pop-Location

# 2. 上传
Write-Host "[2/4] 上传到 $User@$ServerIP ..." -ForegroundColor Cyan
scp -i $Key -o StrictHostKeyChecking=accept-new $tarFile "$User@$ServerIP":/tmp/studyflow-backend.tar.gz
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }

# 3. 安装依赖 + 初始化服务
Write-Host "[3/4] 服务器端解压并安装依赖..." -ForegroundColor Cyan
$remote = @"
set -e
id studyflow >/dev/null 2>&1 || useradd --system --home $target --shell /usr/sbin/nologin studyflow
mkdir -p $target/backend
tar -xzf /tmp/studyflow-backend.tar.gz -C $target/backend
rm -f /tmp/studyflow-backend.tar.gz
cd $target/backend
if ! command -v python3 >/dev/null || ! python3 -m venv --help >/dev/null 2>&1; then
  apt-get update -y && apt-get install -y python3 python3-venv python3-pip
fi
if [ ! -d venv ]; then
  python3 -m venv venv
fi
./venv/bin/pip install -r requirements-lock.txt -q -i https://pypi.tuna.tsinghua.edu.cn/simple
if [ ! -f .env ]; then
  cp .env.example .env
fi
chown -R studyflow:studyflow $target/backend
chmod 600 .env
"@
ssh -i $Key -o StrictHostKeyChecking=accept-new "$User@$ServerIP" $remote
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }

# 4. 注册 systemd 服务
Write-Host "[4/4] 注册 systemd 服务..." -ForegroundColor Cyan
$serviceContent = Get-Content (Join-Path $PSScriptRoot "studyflow.service") -Raw
$b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($serviceContent))
$remote2 = "echo $b64 | base64 -d > /etc/systemd/system/studyflow.service && systemctl daemon-reload && systemctl enable studyflow && systemctl restart studyflow && curl --fail --silent http://127.0.0.1:8000/api/health && systemctl status studyflow --no-pager | head -5"
ssh -i $Key -o StrictHostKeyChecking=accept-new "$User@$ServerIP" $remote2
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }

# 5. 可选: Nginx 配置
if ($SetupNginx) {
    Write-Host "配置 Nginx..." -ForegroundColor Cyan
    $nginxContent = Get-Content (Join-Path $PSScriptRoot "studyflow-nginx.conf") -Raw
    $b64n = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($nginxContent))
    $remote3 = "echo $b64n | base64 -d > /etc/nginx/conf.d/studyflow.conf && nginx -t && systemctl reload nginx"
    ssh -i $Key -o StrictHostKeyChecking=accept-new "$User@$ServerIP" $remote3
if ($LASTEXITCODE -ne 0) { throw "Deployment command failed with exit code $LASTEXITCODE" }
}

Write-Host ""
Write-Host "✅ 后端已部署! 验证: http://$ServerIP/api/health 应返回 {'status':'ok'}" -ForegroundColor Green
Write-Host "   ⚠ 接入大模型: 编辑服务器 $target/backend/.env 配置 LLM_API_KEY 后"
Write-Host "     ssh $User@$ServerIP 'systemctl restart studyflow'"

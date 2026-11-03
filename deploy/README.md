# 学迹 StudyFlow — 一键部署包

从零到上线共 3 步（总耗时约 15 分钟）。

## 第 0 步：准备华为云 ECS（一次性）

1. 注册华为云并完成实名认证（学生可享优惠/免费试用 ECS）
2. 控制台 → 弹性云服务器 ECS → 购买：
   - 规格：2核4G（最低配即可）· Ubuntu 22.04
   - 登录方式：**密钥对** → 粘贴本机已生成的公钥（`C:\Users\你\.ssh\studyflow_deploy.pub`，若还没有运行 `ssh-keygen -t ed25519` 生成）
3. 安全组放行：**22（SSH）、80（HTTP）、443（HTTPS）**
4. 记下公网 IP（如 123.45.67.89）

## 第 1 步：部署前端

```powershell
cd D:\demo\Study_Flow\deploy
.\deploy-frontend.ps1 -ServerIP 123.45.67.89 -Rebuild
```

## 第 2 步：部署后端 + Nginx（一条命令）

```powershell
.\deploy-backend.ps1 -ServerIP 123.45.67.89 -SetupNginx
```

## 完成 🎉

- 网站地址：`http://123.45.67.89`（任何人可访问）
- 后端健康检查：`http://123.45.67.89/api/health`
- 大模型接入：`ssh root@123.45.67.89` → 编辑 `/var/www/studyflow/backend/.env` 填 `LLM_API_KEY` → `systemctl restart studyflow`

## 常用运维命令

```bash
# 更新前端(本地改代码后)
.\deploy-frontend.ps1 -ServerIP 123.45.67.89 -Rebuild

# 查看后端日志
ssh root@123.45.67.89 'journalctl -u studyflow -f'

# 重启后端
ssh root@123.45.67.89 'systemctl restart studyflow'
```

## 后续优化（可选）

- 域名 + HTTPS：见 `../docs/华为云部署指南.md` 第五步
- 华为云 RDS MySQL：改 `.env` 的 `DATABASE_URL`（默认 SQLite 已可用）
- 用 CodeArts 流水线实现"提交代码自动部署"（初赛材料加分项）

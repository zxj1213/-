import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 学迹 StudyFlow - Vite 配置
// /api 代理到 FastAPI 后端(本机未安装 Python 时前端自动降级为内置规则引擎)
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    // 允许通过内网穿透(隧道)域名访问
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
})

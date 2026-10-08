import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 실제 배포: FastAPI 서버가 dist/ 를 정적 파일로 내보내고 /api 를 처리한다.
// 데모(--mode demo): 가짜 데이터(mock)로 동작하는 한 장짜리 HTML 을 만든다.
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: './',
  define: {
    __API_MODE__: JSON.stringify(mode === 'demo' ? 'mock' : (process.env.API_MODE || 'http')),
    __ROUTER_MODE__: JSON.stringify(mode === 'demo' ? 'memory' : 'web'),
  },
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist', assetsInlineLimit: 100000 },
  server: { proxy: { '/api': 'http://localhost:8000' } },
}))

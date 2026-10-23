// M3 的 Vite 配置（工单 §4 M3：Vite + Canvas；Q3 裁定 A：vite 仅进 devDependencies）。
// 刻意只做最小一件事：把根目录指到 webui/。构建产物落 webui/dist/，不属于交付清单。
// 测试面与它无关 —— npm test 仍然是 node test/run.ts，直接跑 .ts，不经过 vite。
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'webui',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});

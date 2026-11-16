import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 独立的 vitest 配置：刻意**不加载** vite-plugin-electron，
// 否则 vitest 会把 electron 主进程入口当成构建目标，测试环境起不来。
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    // 默认 node 环境（纯逻辑测试快）。
    // 需要 DOM 的组件测试请在文件首行加：// @vitest-environment jsdom
    environment: 'node',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx'
      ]
    }
  }
})

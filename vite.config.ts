import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'

// index.html 的 meta CSP 保持生产严格策略（无 localhost、无 unsafe-inline）。
// 开发模式 HMR 需要 ws://localhost:5173，这里仅在 dev server 注入放宽的 connect-src。
function injectDevCsp(): Plugin {
  return {
    name: 'inject-dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        /connect-src 'self';/,
        "connect-src 'self' http://localhost:5173 ws://localhost:5173;"
      )
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    injectDevCsp(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    electronRenderer()
  ],
  css: {
    postcss: './postcss.config.js'
  }
})

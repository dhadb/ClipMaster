# 贡献指南（CONTRIBUTING）

感谢关注 ClipMaster。本文档说明如何本地开发、跑测试、提交符合规范的变更。

## 开发环境要求

| 项 | 要求 |
| --- | --- |
| 操作系统 | Windows 10 / 11（应用与打包链路均以 Windows 为目标） |
| Node.js | >= 22.12.0（CI 用 22.x；建议用 nvm-windows/fnm 固定版本） |
| npm | >= 10.9.0 |
| 首次安装 | `npm ci --registry=https://registry.npmjs.org`（与 CI 的 `scripts/install-dependencies.ps1` 一致，带重试） |

安装失败排查：确认 npm 源可达、`package-lock.json` 与 `package.json` 同步（CI 有 `check-overrides` 门禁，改了 `overrides` 必须重新 `npm install` 刷新 lockfile）。

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（Electron 渲染层热更新） |
| `npm run typecheck` | 双 tsconfig（app + node）类型检查，不产出文件 |
| `npm run lint` | ESLint，覆盖 `src` 与 `electron`，0 error 才算通过（存量 warning 不阻塞） |
| `npm test` / `npm run test:coverage` | Vitest 单测；coverage 版会产出 `coverage/`（含 job summary 用的 json-summary） |
| `npm run check` | 本地全量检查：typecheck + vitest + vite build |
| `npm run check:build` | CI 用的轻量检查：typecheck + vite build（不重复跑测试） |
| `npm run build` | 产出安装包：typecheck + vite build + electron-builder（NSIS/portable，输出到 `release/`） |
| `npm run build:release` | 同上，附带强制代码签名参数（发布流水线用） |
| `node scripts/check-overrides.mjs` | 校验 `package.json` overrides 与 lockfile/实装版本一致（CI 门禁） |

## 提交信息规范

遵循 Conventional Commits，描述用中文（与现有历史一致）：

```
类型(范围): 简短描述

正文可补充动机与影响；破坏性变更需在正文标注。
```

- 类型：`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `build`
- 范围参考：`core`（主进程/业务逻辑）、`ui`（渲染层组件）、`build`（打包/CI）、`readme` 等按实际改动选择
- 示例（取自仓库历史）：
  - `feat(core): 更新链 fail-closed，安装前复校哈希并清理残留安装包`
  - `fix(ui): 修复静默丢数据路径与高频率进程创建`
  - `chore(build): 卸载默认保留用户数据，等待产品决策`

一个提交只做一件事；重构与行为变更不要混在同一提交里。

## Pull Request 与测试要求

1. **提交前本地自测**：`npm run lint`、`npm run typecheck`、`npx vitest run` 全绿；涉及构建/打包的改动再跑 `npx vite build`。
2. **CI 必须绿**：PR 会触发 Build workflow（lint → overrides 检查 → 非阻塞审计+摘要 → vitest+coverage → typecheck+build → 打包产物）。覆盖率当前只出报告不设阈值，但新增代码不应显著拉低基线。
3. **新增依赖**：优先不引依赖；确需引入时说明用途与体积影响，并确认 `npm audit` 不新增 high/critical（运行时依赖是硬要求，dev 依赖需在审计摘要里可解释）。
4. **改动 `overrides` / lockfile**：必须同步更新并本地跑 `node scripts/check-overrides.mjs`，CI 会校验一致性。
5. **UI 改动**：遵循现有无障碍基线（交互元素可键盘访问等，见 `eslint.config.js` 中的 jsx-a11y 规则），并补组件测试。
6. **文档**：影响用户可感知行为的改动同步更新 `README.md`/`README.en.md`；架构/供应链取舍写入 `docs/DECISIONS.md`（沿用 D-xxx 编号）。

## 安装器与发布注意事项

- NSIS 自定义逻辑集中在 `build/installer.nsh`（由 `package.json → build.nsis.include` 注入）。该脚本**无法自动化验证**：改动后必须人工执行一次安装/卸载，确认页面交互与数据清理行为（卸载默认保留 `%APPDATA%\ClipMaster`，见 `docs/DECISIONS.md` D-007）。
- 发布走 tag：推送 `v*` tag 触发 Release workflow，tag 必须与 `package.json` 版本一致，且 `CHANGELOG.md` 含对应版本小节（CI 会校验）。
- 代码签名与证书管理见 `docs/CODE_SIGNING.md`；不要把任何证书/密钥提交进仓库（`.gitignore` 已覆盖常见格式）。

## 安全问题

不要通过公开 Issue/PR 披露安全漏洞，按 `SECURITY.md` 的渠道报告。

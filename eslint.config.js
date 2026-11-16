// eslint.config.js —— ESLint 9 flat config 基线（QA 建立并维护）
//
// 目的：把"人眼评审"里能机械判定的问题变成可回归的门禁信号，尤其是
//   1) jsx-a11y/no-nested-interactive —— 任务卡片/列表项里嵌套 button 导致的交互 bug（P0 来源）
//   2) react-hooks/rules-of-hooks + exhaustive-deps —— 条件调用 Hook / 依赖漏写导致的陈旧闭包
//   3) jsx-a11y 交互元素必须可键盘访问（role/tabIndex/onKeyDown 三件套）
//
// 本次只负责"配置正确、能跑、输出可信"，不修既有问题（组件归前端工程师）。
// 存量基线由 `npx eslint src --format json` 的按规则汇总表给出，分批消项。
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  {
    // 构建产物与生成文件：不参与 lint（非手写、不可修）
    ignores: [
      'dist/**',
      'dist-electron/**',
      'release/**',
      'coverage/**',
      'node_modules/**',
      'public/**',
      'docs/**',
      'scripts/**',
      'installer/**',
      '*.config.js',
      '*.config.ts',
      'vitest.setup.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // TS 由编译器负责符号解析，no-undef 在 TS 文件里只会误报
      'no-undef': 'off',
      // 存量较多且不产生运行时缺陷：降级为 warn，纳入基线但不阻塞门禁
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Electron 前台应用的 console 是合法诊断手段
      'no-console': 'off',
      ...reactHooks.configs['recommended-latest'].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // 注：eslint-plugin-jsx-a11y@6.10.2 共 39 条规则，**没有** no-nested-interactive
      // （实测报错：Could not find "no-nested-interactive" in plugin "jsx-a11y"）。
      // "嵌套可交互元素"改由运行时守卫覆盖：src/components/ClipboardItemCard.integration.test.tsx
      // 断言 React 不打印 validateDOMNesting 警告。静态侧则用下面三条兜住可键盘访问性。
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-tabindex': 'error',
      // Electron 渲染层用 <div onClick> 是既有模式，强制 role 会遮蔽真正该修的嵌套问题；
      // 先按 warn 统计，等存量清零后再提为 error
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      // 测试里 mock 大量使用 any 形状的外部对象，属正常
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Electron 主进程：纯 Node/CommonJS 风格源码（无 DOM、无 JSX）。
    files: ['electron/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // TS 由编译器负责符号解析，no-undef 在 TS 文件里只会误报
      'no-undef': 'off',
    },
  },
  {
    // 以下为 electron/main.ts 存量问题的按行关闭（CI 接入 lint 时不阻塞门禁）。
    // 每处都注明行号与理由，修复合并后应删除对应条目，而不是长期保留。
    files: ['electron/main.ts'],
    rules: {
      // L286 `try { JSON.parse(...) } catch {}`：空 catch 是刻意吞掉解析失败，
      // 失败时走后续类型推断分支，非遗漏处理。
      'no-empty': ['error', { allowEmptyCatch: true }],
      // L289/939/946/2017/2035：字符串里的正则转义被误判（文件里含 PowerShell
      // here-string 片段，`\[` `\"` 是字符串字面量内容而非正则字面量）。
      'no-useless-escape': 'off',
      // L564/570：`/[\u0000-\u001f]/g` 是刻意匹配控制字符并清洗它们，
      // no-control-regex 在此属于误报。
      'no-control-regex': 'off',
    },
  },
)

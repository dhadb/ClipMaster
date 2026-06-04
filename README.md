<p align="center">
  <img src="public/icon.png" width="120" alt="ClipMaster Logo">
</p>

<h1 align="center">ClipMaster</h1>

<p align="center">
  <strong>现代化 Windows 剪贴板管理器</strong>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-快捷键">快捷键</a> •
  <a href="#-自定义设置">设置</a> •
  <a href="#-技术栈">技术栈</a> •
  <a href="#-开发指南">开发</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows-green.svg" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License">
  <img src="https://img.shields.io/badge/electron-27-blue.svg" alt="Electron">
  <img src="https://img.shields.io/badge/react-18-blue.svg" alt="React">
  <img src="https://img.shields.io/badge/typescript-5-blue.svg" alt="TypeScript">
</p>

---

## ✨ 功能特性

### 📋 核心功能

| 功能 | 描述 |
|------|------|
| **实时监控** | 自动捕获剪贴板内容变化，毫秒级响应 |
| **历史记录** | 保存最多 500 条剪贴板历史，支持持久化存储 |
| **智能分类** | 自动识别 7 种内容类型（文本/链接/邮箱/代码/颜色/数字/长文本） |
| **快速搜索** | 模糊搜索历史内容，120ms 防抖优化 |
| **类型筛选** | 按内容类型快速过滤，精准定位 |
| **收藏管理** | 置顶重要内容，清空历史时保留收藏 |
| **使用统计** | 查看详细的数据分析（类型分布、时段高峰等） |
| **数据导出** | 导出历史记录为 JSON 文件 |

### 🎨 界面设计

- **毛玻璃效果** — 现代感十足的半透明界面
- **纯 CSS 动画** — 60fps 流畅过渡，无第三方动画库依赖
- **虚拟滚动** — 大量数据时保持丝滑流畅
- **深色主题** — 护眼的暗色配色方案

### ⚡ 性能优化

- **虚拟列表** — 只渲染可视区域 ±4 项，500 条记录无压力
- **React.memo** — 全组件记忆化，避免无效重渲染
- **Zustand Selector** — 精准状态订阅，最小化渲染范围
- **GPU 加速** — CSS `translateZ(0)` 合成层优化
- **数据持久化** — 自动保存到 `%AppData%/ClipMaster/`

---

## 🚀 快速开始

### 安装使用

1. 前往 [Releases](https://github.com/dhadb/-/releases) 页面下载最新版本
2. 运行 `ClipMaster Setup 1.0.0.exe`
3. 按照安装向导完成安装
4. 开始使用！复制任意内容，按 `Ctrl+Shift+V` 查看

### 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10/11 (64-bit) |
| 内存 | ≥ 256 MB 可用 |
| 磁盘 | ≥ 150 MB 安装空间 |

---

## ⌨️ 快捷键

| 快捷键 | 功能 | 范围 |
|--------|------|------|
| `Ctrl + Shift + V` | 显示 / 隐藏窗口 | 全局 |
| `Ctrl + F` | 聚焦搜索框 | 应用内 |
| `↑` / `↓` | 上下导航选择 | 应用内 |
| `Enter` | 复制选中项 | 应用内 |
| `Delete` | 删除选中项 | 应用内 |
| `Esc` | 清空搜索 / 关闭 | 应用内 |

---

## 🛠️ 自定义设置

### 通用设置

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| 开机自启动 | Windows 启动时自动运行 | 开启 |
| 最小化到托盘 | 关闭窗口时继续后台运行 | 开启 |
| 双击复制 | 双击项目时自动复制 | 开启 |
| 悬停预览 | 鼠标悬停显示完整内容 | 开启 |
| 最大历史数 | 保存的历史记录上限 | 200 条 |

### 外观设置

| 设置项 | 范围 | 默认值 |
|--------|------|--------|
| 窗口透明度 | 70% ~ 100% | 95% |
| 字体大小 | 12px ~ 18px | 14px |
| 窗口宽度 | 350px ~ 600px | 420px |
| 窗口高度 | 400px ~ 800px | 600px |

---

## 📁 项目结构

```
clipmaster/
├── electron/                    # Electron 主进程
│   ├── main.ts                 # 主进程（剪贴板监控、数据持久化）
│   └── preload.ts              # 预加载脚本（IPC 桥接）
├── src/                         # React 前端
│   ├── components/             # UI 组件
│   │   ├── TitleBar.tsx        #   标题栏
│   │   ├── SearchBar.tsx       #   搜索栏（带筛选）
│   │   ├── TabBar.tsx          #   标签栏
│   │   ├── ClipboardList.tsx   #   虚拟滚动列表
│   │   ├── ClipboardItemCard.tsx # 列表项卡片
│   │   ├── SettingsPanel.tsx   #   设置面板
│   │   ├── StatsPanel.tsx      #   统计面板
│   │   └── EmptyState.tsx      #   空状态
│   ├── store/                  # 状态管理
│   │   └── clipboardStore.ts   #   Zustand Store
│   ├── types/                  # TypeScript 类型
│   │   └── electron.d.ts       #   Electron API 类型
│   ├── App.tsx                 # 主应用组件
│   ├── main.tsx                # 入口文件
│   └── index.css               # 全局样式
├── public/                      # 静态资源
│   ├── icon.ico                #   应用图标
│   ├── icon.png                #   PNG 图标
│   └── icon.svg                #   SVG 源文件
├── installer-app/               # 自定义动画安装器
│   ├── main.js                 #   安装器主进程
│   └── src/index.html          #   安装器界面
├── scripts/                     # 工具脚本
│   ├── generate-icon.js        #   图标生成
│   └── generate-installer-assets.js # 安装器资源生成
├── package.json                 # 项目配置
├── vite.config.ts               # Vite 配置
├── tailwind.config.js           # Tailwind 配置
└── tsconfig.json                # TypeScript 配置
```

---

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Electron](https://www.electronjs.org/) | 27.x | 跨平台桌面应用框架 |
| [React](https://react.dev/) | 18.x | 用户界面库 |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | 类型安全的 JavaScript |
| [Vite](https://vitejs.dev/) | 5.x | 下一代前端构建工具 |
| [Tailwind CSS](https://tailwindcss.com/) | 3.x | 实用优先的 CSS 框架 |
| [Zustand](https://zustand-demo.pmnd.rs/) | 4.x | 轻量级状态管理 |
| [Lucide React](https://lucide.dev/) | 0.292 | 精美图标库 |
| [date-fns](https://date-fns.org/) | 2.x | 现代日期处理工具 |

---

## 📦 开发指南

### 环境准备

- [Node.js](https://nodejs.org/) >= 18
- [Git](https://git-scm.com/)

### 克隆项目

```bash
git clone https://github.com/dhadb/-.git
cd clipmaster
```

### 安装依赖

```bash
npm install
```

### 启动开发

```bash
npm run dev
```

或双击 `dev.bat`

### 构建打包

```bash
npm run build
```

或双击 `build.bat`

构建产物位于 `release/` 目录。

---

## 📝 更新日志

### v1.0.0 (2026-06-02)

**✨ 新功能**
- 剪贴板实时监控与历史记录
- 智能内容分类（7 种类型）
- 快速搜索与类型筛选
- 收藏与置顶管理
- 使用统计面板（类型分布、时段高峰）
- 数据持久化存储
- 全局快捷键 `Ctrl+Shift+V`
- 系统托盘运行
- 导出历史记录为 JSON
- 自定义动画安装器

**⚡ 性能优化**
- 虚拟滚动列表（仅渲染可视区域）
- 纯 CSS 动画（无第三方动画库）
- React.memo 全组件记忆化
- Zustand 精准状态订阅
- 120ms 搜索防抖

**🐛 问题修复**
- 修复系统托盘退出无效的问题
- 修复 IPC 监听器内存泄漏
- 修复设置更新的闭包陈旧问题
- 修复筛选后选中项失效的问题
- 添加初始化错误处理
- 添加剪贴板监控错误捕获

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<p align="center">
  <strong>ClipMaster</strong> — 让剪贴板管理更高效 🚀
</p>

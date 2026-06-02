# ClipMaster - 现代化 Windows 剪贴板管理器

<div align="center">

![ClipMaster](public/icon.svg)

**一款功能强大、界面美观的 Windows 剪贴板历史管理工具**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows-green.svg)]()
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)]()

</div>

---

## ✨ 功能亮点

### 🎨 现代化界面设计
- **玻璃态效果** - 毛玻璃背景，现代感十足
- **流畅动画** - 基于 Framer Motion 的丝滑过渡动画
- **深色主题** - 护眼的深色配色方案
- **响应式布局** - 自适应窗口大小调整

### 📋 核心功能
| 功能 | 说明 |
|------|------|
| 🔄 **实时监控** | 自动捕获剪贴板内容变化 |
| 📜 **历史记录** | 保存最多 500 条剪贴板历史 |
| 🏷️ **智能分类** | 自动识别文本、链接、邮箱、代码等类型 |
| 🔍 **快速搜索** | 模糊搜索历史内容 |
| ⭐ **收藏功能** | 置顶重要片段，永不丢失 |
| 📊 **使用统计** | 查看详细的使用数据分析 |
| 📤 **导出功能** | 导出历史记录为 JSON 文件 |
| 🎯 **类型筛选** | 按内容类型快速筛选 |

### 📊 智能类型识别
- 📝 **普通文本** - 一般文字内容
- 🔗 **链接** - URL 网址
- 📧 **邮箱** - 电子邮件地址
- 🎨 **颜色** - HEX/RGB 颜色值（带预览）
- 🔢 **数字** - 数值内容
- 💻 **代码** - 编程代码片段（语法高亮）
- 📄 **长文本** - 超过 100 字符的内容

### ⌨️ 快捷键
| 快捷键 | 功能 | 范围 |
|--------|------|------|
| `Ctrl + Shift + V` | 显示/隐藏窗口 | 全局 |
| `Ctrl + F` | 聚焦搜索框 | 应用内 |
| `↑ ↓` | 导航选择项目 | 应用内 |
| `Enter` | 复制选中项 | 应用内 |
| `Delete` | 删除选中项 | 应用内 |
| `Esc` | 清空搜索/关闭 | 应用内 |

### 🛠️ 高度自定义
- **窗口透明度** - 70% ~ 100%
- **字体大小** - 12px ~ 18px
- **窗口宽度** - 350px ~ 600px
- **窗口高度** - 400px ~ 800px
- **最大历史数** - 50 ~ 500 条
- **自动启动** - 开机自启
- **托盘运行** - 最小化到系统托盘
- **复制提示音** - 开启/关闭

---

## 🚀 快速开始

### 安装使用

1. 下载 `ClipMaster Setup 1.0.0.exe`
2. 运行安装程序
3. 按照向导完成安装
4. 开始使用！

### 开发调试

```bash
# 克隆项目
git clone https://github.com/your-username/clipmaster.git
cd clipmaster

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 或双击 dev.bat

# 构建打包
npm run build

# 或双击 build.bat
```

---

## 📁 项目结构

```
clipmaster/
├── electron/                  # Electron 主进程
│   ├── main.ts               # 主进程入口（剪贴板监控）
│   └── preload.ts            # 预加载脚本（API 桥接）
├── src/                       # React 前端
│   ├── components/           # UI 组件
│   │   ├── TitleBar.tsx          # 标题栏（窗口控制）
│   │   ├── SearchBar.tsx         # 搜索框（带筛选）
│   │   ├── TabBar.tsx            # 标签栏（历史/收藏/统计/设置）
│   │   ├── ClipboardList.tsx     # 剪贴板列表
│   │   ├── ClipboardItemCard.tsx # 列表项卡片
│   │   ├── SettingsPanel.tsx     # 设置面板
│   │   ├── StatsPanel.tsx        # 统计面板
│   │   └── EmptyState.tsx        # 空状态
│   ├── store/                # 状态管理
│   │   └── clipboardStore.ts # Zustand Store
│   ├── types/                # TypeScript 类型
│   │   └── electron.d.ts    # Electron API 类型
│   ├── App.tsx               # 主应用组件
│   ├── main.tsx              # 入口文件
│   └── index.css             # 全局样式
├── public/                   # 静态资源
├── package.json              # 项目配置
├── vite.config.ts            # Vite 配置
├── tailwind.config.js        # Tailwind 配置
├── tsconfig.json             # TypeScript 配置
├── dev.bat                   # 开发启动脚本
└── build.bat                 # 构建打包脚本
```

---

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 27.x | 桌面应用框架 |
| React | 18.x | UI 库 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Tailwind CSS | 3.x | 样式框架 |
| Framer Motion | 10.x | 动画库 |
| Zustand | 4.x | 状态管理 |
| Lucide React | 0.292 | 图标库 |
| date-fns | 2.x | 日期处理 |

---

## 📝 更新日志

### v1.0.0 (2026-06-02)
- 🎉 首次发布
- ✨ 剪贴板实时监控
- ✨ 智能内容分类（7种类型）
- ✨ 搜索和筛选功能
- ✨ 收藏和置顶功能
- ✨ 使用统计面板
- ✨ 导出历史记录
- ✨ 高度可定制设置
- ✨ 流畅动画效果
- ✨ 全局快捷键支持
- ✨ 系统托盘运行

---

## 📄 许可证

MIT License

---

<div align="center">

**ClipMaster** - 让剪贴板管理更高效 🚀

</div>

<p align="center">
  <img src="public/icon.png" width="112" alt="ClipMaster Logo">
</p>

<h1 align="center">ClipMaster</h1>

<p align="center">
  <strong>Windows 本地隐私剪贴板管理器</strong>
</p>

<p align="center">
  记录、搜索、收藏和管理剪贴板历史。数据只保存在本机，不上传云端。
</p>

<p align="center">
  <a href="https://github.com/dhadb/ClipMaster/releases/latest"><strong>下载 Windows 安装包</strong></a>
  ·
  <a href="README.en.md">English</a>
  ·
  <a href="PRIVACY.md">隐私说明</a>
  ·
  <a href="SECURITY.md">安全说明</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.5.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-green.svg" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License">
  <img src="https://img.shields.io/badge/privacy-local--first-brightgreen.svg" alt="Local first">
  <img src="https://img.shields.io/badge/built%20with-Electron%20%2B%20React-blue.svg" alt="Electron and React">
</p>

<p align="center">
  <img src="docs/screenshot.png" width="760" alt="ClipMaster 应用截图">
</p>

## 为什么用 ClipMaster

- **本地优先**：剪贴板历史、设置和图片缓存只写入本机 `%AppData%/ClipMaster/`。
- **快速找回**：复制过的文本、链接、代码、颜色、JSON、Markdown 和图片都可以搜索和筛选。
- **隐私保护**：默认跳过疑似密码、Token、私钥、银行卡号等高风险内容。
- **键盘友好**：使用 `Ctrl + Shift + V` 全局唤起，搜索、选择、复制都可以快速完成。
- **顺手高效**：时间范围、类型和排序可以组合筛选，批量收藏、置顶、加标签与删除不再逐条操作。

## 快速开始

### 安装使用

1. 打开 [Releases](https://github.com/dhadb/ClipMaster/releases/latest)。
2. 下载 `ClipMaster-Setup-1.5.0.exe`，或选择 `ClipMaster-Portable-1.5.0.exe` 免安装版。
3. 运行安装包并按向导安装；便携版可直接运行。
4. 复制任意内容并按 `Ctrl + Shift + V` 打开 ClipMaster。

### 校验安装包

Release 页面会附带 `checksums.sha256`。下载后可以在 PowerShell 中校验：

```powershell
Get-FileHash -Algorithm SHA256 ".\ClipMaster-Setup-1.5.0.exe"
```

将输出的 SHA256 与 `checksums.sha256` 中的值对比。如果不一致，请不要运行安装包，并在 [Issues](https://github.com/dhadb/ClipMaster/issues) 中反馈。

> Windows 可能会对未签名的开源安装包显示 SmartScreen 提醒。请只从本仓库的 GitHub Releases 下载。

### 应用内更新

从 `v1.4.1` 开始，ClipMaster 检查到新版本后可以直接在应用内下载官方 Windows 安装包，显示下载进度，并在完成后安装并重启。下载失败时仍可打开 GitHub Release 页面手动处理。

`v1.5.0` 进一步使用 Electron `safeStorage` 加密本地历史和设置，支持显示、搜索、清理三组全局快捷键，并将图片缩略图压缩为低占用 JPEG。

## 功能特性

| 功能 | 说明 |
| --- | --- |
| 实时监控 | 自动捕获剪贴板内容变化 |
| 历史记录 | 最多保存 500 条历史，支持持久化存储 |
| 智能分类 | 自动识别文本、链接、邮箱、代码、颜色、JSON、Markdown、图片等类型 |
| 组合筛选 | 搜索内容和 `#标签`，组合类型、时间范围、最新/最早/常用排序与 `type:` 查询 |
| 常用片段 | 手动保存常用文本、命令或回复，可直接收藏和置顶 |
| 标签整理 | 为任意文本记录添加标签，标签随文本备份完整保留 |
| 收藏管理 | 收藏重要内容，清空历史时保留收藏 |
| 批量处理 | 多选记录后统一置顶、收藏、加标签或删除 |
| 内容编辑 | 在详情页直接修改片段内容和标签，自动重新识别内容类型 |
| 删除撤销 | 批量或单条删除后可在提示消失前快速恢复 |
| 使用统计 | 查看类型分布、时段高峰等数据 |
| 个性化外观 | 八种主题、五种独立强调色、列表密度、字体、透明度与窗口尺寸 |
| 更新检查 | 启动后或在帮助页检查 GitHub Releases，可在应用内下载、安装并重启 |
| 数据安全 | 使用 Electron `safeStorage` 加密本地持久化数据，并兼容旧版明文数据迁移 |
| 全局快捷键 | 支持弹出历史、聚焦搜索、清理未保护记录，并可在设置中分别配置 |
| 图片性能 | 生成 256px JPEG 缩略图，限制渲染层缓存，自动清理未引用图片文件 |
| 数据导入导出 | 导出不含图片和本机路径的文本元数据 JSON，导入时可选择智能合并或完整替换 |
| 本地隐私 | 不上传、不同步、不分析剪贴板内容 |

## 快捷键

| 快捷键 | 功能 | 范围 |
| --- | --- | --- |
| `Ctrl + Shift + V` | 显示 / 隐藏窗口 | 全局 |
| `Ctrl + Shift + F` | 打开窗口并聚焦搜索 | 全局 |
| `Ctrl + Shift + Delete` | 清理未置顶、未收藏记录 | 全局 |
| `Ctrl + F` | 聚焦搜索框 | 应用内 |
| `Ctrl + N` | 新建常用片段 | 应用内 |
| `↑` / `↓` | 上下选择 | 应用内 |
| `Enter` | 复制选中内容 | 应用内 |
| `Delete` | 删除选中内容 | 应用内 |
| `Esc` | 清空搜索 / 关闭 | 应用内 |

## 隐私与数据存储

ClipMaster 不包含云端服务，不会上传、同步或分析你的剪贴板内容。默认数据目录：

```text
%AppData%/ClipMaster/
```

更多细节请查看 [PRIVACY.md](PRIVACY.md)。

## 开发

### 环境要求

- Node.js 22.12+
- Git
- Windows 10/11

### 本地运行

```bash
git clone https://github.com/dhadb/ClipMaster.git
cd ClipMaster
npm install
npm run dev
```

### 构建安装包

```bash
npm run build -- --publish never
```

构建产物会输出到 `release/`。

## 技术栈

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand

## 路线图

- [ ] 增加更多隐私规则开关
- [x] 支持自定义快捷键
- [x] 增加便携版下载
- [x] 增加安全的更新检查与下载提示
- [ ] 为安装包增加代码签名

## 反馈

欢迎在 [Issues](https://github.com/dhadb/ClipMaster/issues) 中提交 bug、功能建议或安装体验反馈。

## License

[MIT](LICENSE)

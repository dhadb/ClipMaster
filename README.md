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
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
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

## 快速开始

### 安装使用

1. 打开 [Releases](https://github.com/dhadb/ClipMaster/releases/latest)。
2. 下载 `ClipMaster Setup 1.0.0.exe`。
3. 运行安装包并按向导安装。
4. 复制任意内容，按 `Ctrl + Shift + V` 打开 ClipMaster。

### 校验安装包

Release 页面会附带 `checksums.sha256`。下载后可以在 PowerShell 中校验：

```powershell
Get-FileHash -Algorithm SHA256 ".\ClipMaster Setup 1.0.0.exe"
```

将输出的 SHA256 与 `checksums.sha256` 中的值对比。如果不一致，请不要运行安装包，并在 [Issues](https://github.com/dhadb/ClipMaster/issues) 中反馈。

> Windows 可能会对未签名的开源安装包显示 SmartScreen 提醒。请只从本仓库的 GitHub Releases 下载。

## 功能特性

| 功能 | 说明 |
| --- | --- |
| 实时监控 | 自动捕获剪贴板内容变化 |
| 历史记录 | 最多保存 500 条历史，支持持久化存储 |
| 智能分类 | 自动识别文本、链接、邮箱、代码、颜色、JSON、Markdown、图片等类型 |
| 快速搜索 | 模糊搜索历史内容，支持类型筛选 |
| 收藏管理 | 收藏重要内容，清空历史时保留收藏 |
| 使用统计 | 查看类型分布、时段高峰等数据 |
| 数据导出 | 将历史记录导出为 JSON 文件 |
| 本地隐私 | 不上传、不同步、不分析剪贴板内容 |

## 快捷键

| 快捷键 | 功能 | 范围 |
| --- | --- | --- |
| `Ctrl + Shift + V` | 显示 / 隐藏窗口 | 全局 |
| `Ctrl + F` | 聚焦搜索框 | 应用内 |
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

- Node.js 18+
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
- [ ] 支持自定义快捷键
- [ ] 增加便携版下载
- [ ] 增加自动更新或更新提示
- [ ] 为安装包增加代码签名

## 反馈

欢迎在 [Issues](https://github.com/dhadb/ClipMaster/issues) 中提交 bug、功能建议或安装体验反馈。

## License

[MIT](LICENSE)

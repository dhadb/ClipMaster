<p align="center">
  <img src="public/icon.png" width="112" alt="ClipMaster Logo">
</p>

<h1 align="center">ClipMaster</h1>

<p align="center">
  <strong>A local-first clipboard manager for Windows</strong>
</p>

<p align="center">
  Save, search, favorite, and manage clipboard history. Your data stays on your machine.
</p>

<p align="center">
  <a href="https://github.com/dhadb/ClipMaster/releases/latest"><strong>Download for Windows</strong></a>
  ·
  <a href="README.md">中文</a>
  ·
  <a href="PRIVACY.md">Privacy</a>
  ·
  <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.1-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-green.svg" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License">
  <img src="https://img.shields.io/badge/privacy-local--first-brightgreen.svg" alt="Local first">
  <img src="https://img.shields.io/badge/built%20with-Electron%20%2B%20React-blue.svg" alt="Electron and React">
</p>

<p align="center">
  <img src="docs/screenshot.png" width="760" alt="ClipMaster screenshot">
</p>

## Why ClipMaster

- **Local-first**: Clipboard history, settings, and image cache are stored only under `%AppData%/ClipMaster/`.
- **Fast recovery**: Search and filter copied text, links, code snippets, colors, JSON, Markdown, and images.
- **Privacy guardrails**: High-risk content such as passwords, tokens, private keys, and card numbers is skipped by default.
- **Keyboard friendly**: Open the app globally with `Ctrl + Shift + V`, then search, select, and copy quickly.
- **Efficient workflows**: Combine time, type, and sort filters, then batch favorite, pin, tag, or delete records.

## Quick Start

1. Open [Releases](https://github.com/dhadb/ClipMaster/releases/latest).
2. Download `ClipMaster-Setup-1.4.1.exe`, or choose `ClipMaster-Portable-1.4.1.exe`.
3. Run the installer, or launch the portable build directly.
4. Copy anything and press `Ctrl + Shift + V` to open ClipMaster.

## Verify the Installer

Release assets include `checksums.sha256`. After downloading the installer, verify it in PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 ".\ClipMaster-Setup-1.4.1.exe"
```

Compare the SHA256 output with `checksums.sha256`. If it does not match, do not run the installer and report it in [Issues](https://github.com/dhadb/ClipMaster/issues).

Windows may show a SmartScreen warning for unsigned open-source installers. Download ClipMaster only from this repository's GitHub Releases.

### In-app updates

Starting with `v1.4.1`, ClipMaster can download the official Windows installer inside the app after finding a new release, show live progress, and install it with a restart. If the download fails, the GitHub Release page remains available as a fallback.

## Features

| Feature | Description |
| --- | --- |
| Live monitoring | Captures clipboard changes automatically |
| History | Stores up to 500 clipboard entries |
| Smart categories | Detects text, links, emails, code, colors, JSON, Markdown, images, and more |
| Combined filters | Search content and `#tags`, then combine type, time, newest/oldest/usage sorting, and `type:` queries |
| Reusable snippets | Save frequently used text, commands, and replies manually |
| Tags | Organize any entry with tags preserved across import and export |
| Favorites | Pin important clipboard items |
| Batch actions | Pin, favorite, tag, or delete multiple selected records |
| Content editing | Edit snippet content and tags in details with automatic type detection |
| Delete undo | Restore recently deleted records before the notification expires |
| Stats | View type distribution and usage patterns |
| Personalized appearance | Eight themes, five independent accents, density, type size, opacity, and window size |
| Update checks | Check GitHub Releases at startup or manually, then download, install, and restart in the app |
| Import and export | Export text-only JSON metadata without images or local paths, then merge or replace history during import |
| Local privacy | No upload, sync, or clipboard analytics |

## Shortcuts

| Shortcut | Action | Scope |
| --- | --- | --- |
| `Ctrl + Shift + V` | Show / hide window | Global |
| `Ctrl + F` | Focus search | In app |
| `Ctrl + N` | Create a reusable snippet | In app |
| `↑` / `↓` | Move selection | In app |
| `Enter` | Copy selected item | In app |
| `Delete` | Delete selected item | In app |
| `Esc` | Clear search / close | In app |

## Development

Requires Node.js 22.12 or newer.

```bash
git clone https://github.com/dhadb/ClipMaster.git
cd ClipMaster
npm install
npm run dev
```

Build the Windows installer:

```bash
npm run build -- --publish never
```

## License

[MIT](LICENSE)

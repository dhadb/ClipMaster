# Windows Authenticode 签名

正式发布必须使用受信任的 Windows 代码签名证书。ClipMaster 的发布工作流会在 GitHub Actions 的 `windows-latest` Runner 中临时还原 PFX，使用 Electron Builder 签名，并在发布前验证每个 `.exe`。证书和密码不会写入仓库。

## 证书要求

- 使用 OV 或 EV Code Signing Certificate；不要把自签名证书用于公开发布。
- 导出包含私钥的 `.pfx`/`.p12` 文件，并设置强密码。
- 证书用途必须包含 `Code Signing`，且证书在发布时未过期或被吊销。
- 从 CA 或签名服务获取 RFC 3161 时间戳支持。OV 证书首次发布时仍可能触发 SmartScreen 声誉提示；签名不会绕过所有 SmartScreen 警告。

## 配置 GitHub Secrets

将 PFX 转为单行 Base64。以下命令只生成临时文件，不会修改仓库：

```powershell
$pfxBytes = [IO.File]::ReadAllBytes('.\ClipMaster-CodeSigning.pfx')
[Convert]::ToBase64String($pfxBytes) | Set-Content -NoNewline '.\ClipMaster-CodeSigning.pfx.b64'
```

使用 GitHub CLI 写入仓库 Secrets：

```powershell
Get-Content -Raw .\ClipMaster-CodeSigning.pfx.b64 | gh secret set WIN_CSC_LINK --repo dhadb/ClipMaster
gh secret set WIN_CSC_KEY_PASSWORD --repo dhadb/ClipMaster
```

第二条命令会交互式读取密码。确认配置时只查看名称，不要回显值：

```powershell
gh secret list --repo dhadb/ClipMaster
```

也可以在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中创建同名 Repository secrets。

## 发布流程

发布工作流只响应 `v*` 标签，并要求标签版本与 `package.json` 一致。发布前会：

1. 检查两个 Secrets 是否存在。
2. 将 `WIN_CSC_LINK` 的 Base64 内容写入 Runner 临时目录。
3. 使用 `npm run build:release`，其中 `forceCodeSigning` 会让 Electron Builder 在找不到签名身份时直接失败。
4. 对 `release/*.exe` 逐个运行 `Get-AuthenticodeSignature`，状态不是 `Valid` 就停止发布。
5. 发布完成后删除 Runner 临时目录中的 PFX。

证书配置完成后，请递增 `package.json` 版本并创建新标签，例如当前 `v2.0.0` 已发布，应使用 `v2.0.1`，不要覆盖已有 Release 资产：

```powershell
git tag v2.0.1
git push origin v2.0.1
```

## 本地验证

本地构建时不要把证书复制进仓库。可以临时设置环境变量后运行发布构建：

```powershell
$env:WIN_CSC_LINK = (Resolve-Path '.\ClipMaster-CodeSigning.pfx').Path
$env:WIN_CSC_KEY_PASSWORD = Read-Host 'PFX password'
npm run build:release
.\scripts\verify-authenticode.ps1 -Path release
```

完成后立即清除 `$env:WIN_CSC_KEY_PASSWORD`。不要将密码写入脚本、日志或 `.env` 文件。

## 证书轮换

证书续期或更换时，直接更新两个 GitHub Secrets，然后用新版本发布。不要删除旧证书对应的历史 Release；已签名文件的时间戳仍应保持可验证。

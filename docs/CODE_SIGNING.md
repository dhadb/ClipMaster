# Windows Authenticode 签名

ClipMaster 已准备 Windows Authenticode 签名工具链。发布工作流默认以未签名方式构建；只有将仓库 Actions variable `ENABLE_WINDOWS_CODE_SIGNING` 设置为 `true` 时，才会还原 PFX、强制签名并验证每个 `.exe`。证书和密码不会写入仓库。

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

写入前建议在本机完成一次 Base64 往返验证，确认 Secret 内容确实来自包含私钥的 PFX，而不是 `.cer`、证书路径或截图文字：

```powershell
$pfxPath = 'D:\证书\ClipMaster-CodeSigning.pfx'
$encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath))
$roundTripPath = Join-Path $env:TEMP 'clipmaster-codesigning-roundtrip.pfx'
[IO.File]::WriteAllBytes($roundTripPath, [Convert]::FromBase64String($encoded))
$certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
$certificate.Import($roundTripPath, (Read-Host 'PFX password'), [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet)
if (-not $certificate.HasPrivateKey) { throw 'PFX does not contain a private key.' }
Remove-Item -LiteralPath $roundTripPath -Force
$encoded | gh secret set WIN_CSC_LINK --repo dhadb/ClipMaster
```

启用签名时，发布工作流会在 Runner 中检查 PFX 格式、私钥和 `Code Signing` 用途；检查失败时不会开始构建或创建 Release。

也可以在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中创建同名 Repository secrets。

## 发布流程

发布工作流只响应 `v*` 标签，并要求标签版本与 `package.json` 一致。默认构建未签名安装包；启用签名前，请在 GitHub **Settings → Secrets and variables → Actions → Variables** 中创建 `ENABLE_WINDOWS_CODE_SIGNING` 并设为 `true`。启用后，发布前会：

1. 检查两个 Secrets 是否存在。
2. 将 `WIN_CSC_LINK` 的 Base64 内容写入 Runner 临时目录。
3. 使用 `npm run build:release`，其中 `forceCodeSigning` 会让 Electron Builder 在找不到签名身份时直接失败。
4. 对 `release/*.exe` 逐个运行 `Get-AuthenticodeSignature`，状态不是 `Valid` 就停止发布。
5. 发布完成后删除 Runner 临时目录中的 PFX。

当前 `package.json` 已准备为 `2.1.2`。本版本可继续使用默认的未签名发布模式，无需配置证书；不要覆盖此前已经发布的 `v2.0.2` Release 资产：

```powershell
git tag v2.1.2
git push origin v2.1.2
```

以后准备好正式代码签名证书时，再将 `ENABLE_WINDOWS_CODE_SIGNING` 设置为 `true`，并使用新的版本标签发布。

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

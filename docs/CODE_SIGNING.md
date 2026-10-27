# Windows Authenticode 签名

ClipMaster 已准备 Windows Authenticode 签名工具链。发布工作流默认以未签名方式构建；只有将仓库 Actions variable `ENABLE_WINDOWS_CODE_SIGNING` 设置为 `true` 时，才会还原 PFX、强制签名并验证每个 `.exe`。证书和密码不会写入仓库。

## 证书要求

- 使用 OV 或 EV Code Signing Certificate；不要把自签名证书用于公开发布。
- 导出包含私钥的 `.pfx`/`.p12` 文件，并设置强密码。
- 证书用途必须包含 `Code Signing`，且证书在发布时未过期或被吊销。
- 从 CA 或签名服务获取 RFC 3161 时间戳支持。OV 证书首次发布时仍可能触发 SmartScreen 声誉提示；签名不会绕过所有 SmartScreen 警告。

## 证书文件放哪里

证书文件、它的 `.b64` 中间产物、以及 `.cer`/`.crt` 公钥副本，**都必须放在仓库目录之外**。推荐固定目录：

```text
%USERPROFILE%\.clipmaster-signing\
├── ClipMaster-CodeSigning.pfx
└── ClipMaster-CodeSigning.pfx.b64
```

不要为了"方便"把证书复制到仓库根目录（例如 `.\ClipMaster-CodeSigning.pfx`）再执行下面的命令：仓库的 `.gitignore` 虽然已经覆盖 `*.pfx`、`*.p12`、`*.b64`、`*.cer`、`*.crt`、`*.key`、`*.pem`、`*.pvk`、`certificates/`、`secrets/`，但这只是最后一道保险，不是工作习惯。

## 配置 GitHub Secrets

将 PFX 转为单行 Base64。以下命令只生成临时文件，不会修改仓库：

```powershell
$signingDir = Join-Path $env:USERPROFILE '.clipmaster-signing'
New-Item -ItemType Directory -Force -Path $signingDir | Out-Null
$pfxPath = Join-Path $signingDir 'ClipMaster-CodeSigning.pfx'
$b64Path = Join-Path $signingDir 'ClipMaster-CodeSigning.pfx.b64'

$pfxBytes = [IO.File]::ReadAllBytes($pfxPath)
[Convert]::ToBase64String($pfxBytes) | Set-Content -NoNewline $b64Path
```

使用 GitHub CLI 写入仓库 Secrets：

```powershell
Get-Content -Raw $b64Path | gh secret set WIN_CSC_LINK --repo dhadb/ClipMaster
gh secret set WIN_CSC_KEY_PASSWORD --repo dhadb/ClipMaster
```

第二条命令会交互式读取密码。确认配置时只查看名称，不要回显值：

```powershell
gh secret list --repo dhadb/ClipMaster
```

写入前建议在本机完成一次 Base64 往返验证，确认 Secret 内容确实来自包含私钥的 PFX，而不是 `.cer`、证书路径或截图文字（`$pfxPath` 指向仓库外的真实证书路径）：

```powershell
$pfxPath = Join-Path $env:USERPROFILE '.clipmaster-signing\ClipMaster-CodeSigning.pfx'
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

## 仓库卫生自检

任何时候都可以确认某个证书文件确实被忽略（输出会显示命中的 `.gitignore` 行号）：

```powershell
git check-ignore -v "$env:USERPROFILE\.clipmaster-signing\ClipMaster-CodeSigning.pfx"
git status --short --untracked-files=all
```

如果证书曾经被提交过，删除文件并追加 `.gitignore` 是不够的——历史提交里仍然有它。正确做法是立刻在该 CA 吊销并重签证书，然后按 GitHub 文档清理历史。是否清理历史属于维护者的独立决策，不在本文档范围内。

## 发布流程

发布工作流只响应 `v*` 标签，并要求标签版本与 `package.json` 一致。默认构建未签名安装包；启用签名前，请在 GitHub **Settings → Secrets and variables → Actions → Variables** 中创建 `ENABLE_WINDOWS_CODE_SIGNING` 并设为 `true`。启用后，发布前会：

1. 检查两个 Secrets 是否存在。
2. 将 `WIN_CSC_LINK` 的 Base64 内容写入 Runner 临时目录。
3. 使用 `npm run build:release`，其中 `forceCodeSigning` 会让 Electron Builder 在找不到签名身份时直接失败。
4. 对 `release/*.exe` 逐个运行 `Get-AuthenticodeSignature`，状态不是 `Valid` 就停止发布。
5. 发布完成后删除 Runner 临时目录中的 PFX。

当前 `package.json` 已准备为 `5.0.0`。本版本可继续使用默认的未签名发布模式，无需配置证书；不要覆盖此前已经发布的 Release 资产：

```powershell
git tag v5.0.0
git push origin v5.0.0
```

以后准备好正式代码签名证书时，再将 `ENABLE_WINDOWS_CODE_SIGNING` 设置为 `true`，并使用新的版本标签发布。

## 本地验证

本地构建时不要把证书复制进仓库。用环境变量指向仓库外的证书路径后运行发布构建：

```powershell
$env:WIN_CSC_LINK = (Resolve-Path (Join-Path $env:USERPROFILE '.clipmaster-signing\ClipMaster-CodeSigning.pfx')).Path
$env:WIN_CSC_KEY_PASSWORD = Read-Host 'PFX password'
npm run build:release
.\scripts\verify-authenticode.ps1 -Path release
```

完成后立即清除 `$env:WIN_CSC_KEY_PASSWORD`。不要将密码写入脚本、日志或 `.env` 文件。

## 证书轮换

证书续期或更换时，直接更新两个 GitHub Secrets，然后用新版本发布。不要删除旧证书对应的历史 Release；已签名文件的时间戳仍应保持可验证。

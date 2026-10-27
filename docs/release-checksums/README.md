# 发布校验和归档格式（release-checksums）

每个正式版本发布后，把该版本所有 `.exe` 的 SHA256 归档到本目录，文件名 `v<version>.sha256`。

## 格式规范

- 每行：`<64 位大写 SHA256><两个空格><文件名>`，ASCII 编码，LF 换行
- **文件名必须与 Release 上的资产名逐字一致**（当前由 `package.json` 的
  `build.nsis.artifactName = "${productName}-Setup-${version}.${ext}"` 决定）
- 只归档这一次实际发布的文件，不要补录、不要修改历史文件

生成方式（与 `.github/workflows/build.yml` 一致）：

```powershell
Get-FileHash -Algorithm SHA256 release/*.exe |
  ForEach-Object { "$($_.Hash)  $([System.IO.Path]::GetFileName($_.Path))" } |
  Set-Content -Encoding ascii "docs/release-checksums/v$env:VERSION.sha256"
```

## 历史归档说明

`v1.0.0.sha256` 中的文件名为 `ClipMaster Setup 1.0.0.exe`（**空格分隔**），
与当前 electron-builder 的连字符命名（`ClipMaster-Setup-<version>.exe`）不一致。

这是历史事实：当时的确是用这个文件名发布的。归档文件的用途是**证明当时发布的东西是什么**，
因此该文件保持原样，不做重命名或补改。新版本请严格按上面的当前规范归档。

另外：`v5.0.0` 及之后各版本应在 GitHub Release 上以 `checksums.sha256` 形式随资产发布
（由 `.github/workflows/release.yml` 生成），本目录只保存归档副本。

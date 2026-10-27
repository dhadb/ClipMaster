# 整改记录（REMEDIATION）

本文件记录 2026-10-26 这一轮**发布/构建工程整改**的全部改动、证据与验收方式。
后续维护者可以照"验收命令"一栏逐条复跑，确认结论仍然成立。

- 仓库：`dhadb/ClipMaster`（本地 `D:\Users\DELL\Desktop\666\剪切板\ClipMaster`）
- 基准 commit：`831c884`（branch `main`）
- 日期：2026-10-26
- 作用域：`.gitignore`、`installer/**`、`docs/**`、`scripts/**`、`build.bat`、`build-installer.bat`、`dev.bat`
- 明确未触碰：`electron/**`、`src/**`、`package.json`、`vite.config.ts`、`.github/workflows/**`（另一角色在处理）、`README*.md`、`CHANGELOG.md`
- 未执行：`git commit`、`npm run build`（本轮按要求不跑）

## 总览

| 编号 | 问题 | 状态 | 优先级 |
| --- | --- | --- | --- |
| R-001 | `.gitignore` 不挡签名证书，`git add .` 会提交 PFX | **已修复** | P0 |
| R-002 | `docs/CODE_SIGNING.md` 指导把 PFX 放工作目录 | **已修复** | P0 |
| R-003 | `installer/installer.nsi` 是 259 行死代码，且与真实产物语义冲突 | **已修复**（删除，见 D-001） | P1 |
| R-004 | `build-installer.bat` 名字暗示"自研安装器"，实际只调 `npm run build` | **已修复**（加注释说明） | P1 |
| R-005 | `latest.yml` / `*.blockmap` 无消费者 | **决策记录**（未改代码，见 D-002） | P2 |
| R-006 | `docs/release-checksums/v1.0.0.sha256` 文件名格式与当前 `artifactName` 不一致 | **已修复**（新增格式规范，历史文件不可回改，见 D-004） | P2 |
| R-007 | `%TEMP%` 中下载的安装包永不清理（`electron/main.ts:1514`） | **未修**（超出本角色作用域，见 D-003） | P2 |

---

## R-001 `.gitignore` 不挡签名证书

**状态**：已修复 ｜ **优先级**：P0

### 问题
`.gitignore` 原本只忽略 `.env*` 系列，没有任何证书/私钥模式。而 `docs/CODE_SIGNING.md` 的本地签名流程要求把 PFX 放在手边，开发者一旦执行 `git add .` 就会把带私钥的证书提交进仓库和 GitHub 历史。

### 证据
- 整改前 `.gitignore:27-32` 只有 `.env`、`.env.local`、`.env.development.local`、`.env.test.local`、`.env.production.local`，全文 42 行无 `*.pfx`/`*.p12`/`*.key` 等。
- 整改前 `docs/CODE_SIGNING.md:17` `[IO.File]::ReadAllBytes('.\ClipMaster-CodeSigning.pfx')`、`:76` `(Resolve-Path '.\ClipMaster-CodeSigning.pfx').Path` —— 均指向仓库工作目录。

### 改法
`.gitignore` 在 Environment 段之后新增（现为 `.gitignore:34-45`）：

```gitignore
# Code signing certificates & secrets
*.pfx
*.p12
*.pem
*.key
*.b64
*.cer
*.crt
*.pvk
certificates/
secrets/
```

### 验收命令
```bash
cd ClipMaster
printf 'fake' > test-cert.pfx
git check-ignore -v test-cert.pfx        # 必须输出命中的 .gitignore 行号
git status --short --untracked-files=all # test-cert.pfx 必须不出现
rm -f test-cert.pfx
```
实测输出见 [附录 A](#附录-a-证书忽略规则实测输出)。

**附加说明**：`.gitignore` 只对未跟踪文件生效，不能保护"已经提交过"的文件。仓库全历史扫描（`git log --all --name-only`）未发现任何证书文件，因此本轮无需清洗历史；如将来发生，必须吊销并重签证书，而不是只删文件。

---

## R-002 `docs/CODE_SIGNING.md` 指导把敏感文件放工作目录

**状态**：已修复 ｜ **优先级**：P0

### 问题
文档把"把 PFX 放仓库根目录"写成默认操作路径（`:17`、`:24`、`:76`），等于持续培养危险习惯——R-001 的 `.gitignore` 只是最后一道保险。

### 证据
- `docs/CODE_SIGNING.md:17-18`：`ReadAllBytes('.\ClipMaster-CodeSigning.pfx')` → 输出 `.\ClipMaster-CodeSigning.pfx.b64`（都在工作目录）
- `docs/CODE_SIGNING.md:24`：`Get-Content -Raw .\ClipMaster-CodeSigning.pfx.b64 | gh secret set ...`
- `docs/CODE_SIGNING.md:76`：`$env:WIN_CSC_LINK = (Resolve-Path '.\ClipMaster-CodeSigning.pfx').Path`

### 改法
- 新增「证书文件放哪里」章节，规定统一目录 `%USERPROFILE%\.clipmaster-signing\`，并说明 `.gitignore` 只是保险、不是工作习惯。
- 上述三处命令全部改为先在 `$signingDir` 里构造路径再使用，Base64 产物也写到仓库外。
- 新增「仓库卫生自检」章节：给出 `git check-ignore -v` + `git status --short --untracked-files=all` 两个自检命令，并写明"若证书曾被提交，正确做法是吊销重签 + 清理历史"。
- 本地验证段（原 `:76`）改为 `Join-Path $env:USERPROFILE '.clipmaster-signing\ClipMaster-CodeSigning.pfx'`。
- 其余内容（证书要求、Secrets 配置步骤、发布流程、证书轮换）保持原意，未增删技术结论。

### 验收命令
```bash
cd ClipMaster
grep -n "ClipMaster-CodeSigning.pfx" docs/CODE_SIGNING.md   # 不应再有 '.\' 开头的工作目录路径
grep -n "clipmaster-signing" docs/CODE_SIGNING.md           # 应命中新目录约定
```

---

## R-003 `installer/installer.nsi` 是死代码且与真实产物语义冲突

**状态**：已修复（删除）｜ **优先级**：P1 ｜ **决策依据**：[DECISIONS.md D-001](./DECISIONS.md#d-001-移除从未进入构建链的自研-nsis-脚本已执行)

### 问题
259 行自研 NSIS 脚本从未被任何脚本或工作流编译；它同时与 electron-builder 的真实产物定义**互斥**（per-machine vs per-user），一旦有人真的去编译它，产出的安装器会写 `$PROGRAMFILES`、要求管理员权限、无条件加开机自启，和现在的实际行为完全不一致。

### 证据
- 构建链从不调用它：`build.bat:7` `call npm run build`；`build-installer.bat:10` `call npm run build`；两文件均无 `makensis`。
- 全仓引用只有它自己：`git grep -E "makensis\|installer.nsi"` 在 HEAD 上除自身外 0 命中（原文见附录 B）。
- 语义冲突：`installer.nsi:11` `InstallDir "$PROGRAMFILES\ClipMaster"`、`:13` `RequestExecutionLevel admin`；而实测构建日志为 `oneClick=false perMachine=false`（per-user 装到 `%LOCALAPPDATA%\Programs`）。
- 另有 5 处具体缺陷（失效官网链接 `:46`、欢迎页重复 `:201-205`、假进度条 `:113-154`、无条件自启 `:242-244`、字符图标与硬编码色 `:89-103/148/168/31-32/142-145`），列在 DECISIONS D-001 表格中。

### 改法
删除 4 个文件（均可从 `831c884` 取回）：

```
installer/installer.nsi          installer/header.bmp
installer/welcome.bmp            scripts/generate-installer-assets.js
```

`installer/` 目录随之清空。`scripts/generate-installer-assets.js` 一并删除的原因：它唯一用途就是往 `installer/` 写上述两个 BMP（`:92`、`:100`、`:109`），脚本删除后它必然失败，且它依赖的 `sharp` 不在依赖清单中。

### 验收命令
```bash
cd ClipMaster
git grep -nE "installer\.nsi|makensis|header\.bmp|welcome\.bmp|generate-installer-assets"  # 必须 0 命中
ls installer 2>/dev/null || echo "installer/ removed"
npm run build   # 安装包仍由 electron-builder 正常产出（本轮未执行，见附录 C）
```

---

## R-004 `build-installer.bat` 的名称误导

**状态**：已修复 ｜ **优先级**：P1

### 问题
脚本名为 "Installer Builder"，容易让人以为它驱动 `installer/installer.nsi`；实际只做 `npm run build` + 生成 checksums（`:10`、`:20`）。

### 证据
`build-installer.bat:9` `echo [1/2] Building application and installer...`、`:10` `call npm run build`、`:20` 生成 `release/checksums.sha256`，无 `makensis`。

### 改法
在文件头加 6 行注释，说明"Windows 安装包由 electron-builder 生成（`package.json` → `build.win.target = ["nsis","portable"]`），本脚本只是 `npm run build` + checksums 的便捷入口，原 `installer/installer.nsi` 已移除并指向 `docs/DECISIONS.md` D-001"。未改任何命令逻辑。

### 验收命令
```bash
cd ClipMaster
head -8 build-installer.bat          # 应看到 4 行 rem 说明
grep -c "call npm run build" build-installer.bat   # 仍为 1，逻辑未变
```

---

## R-005 `latest.yml` 与 `*.blockmap` 是冗余产物

**状态**：决策记录（本轮不改代码/工作流）｜ **优先级**：P2 ｜ 详见 [DECISIONS.md D-002](./DECISIONS.md#d-002-latestyml-与-blockmap接差分更新还是删掉待定)

### 问题与证据
`npm run build` 会生成 `release/latest.yml` 与 `ClipMaster-Setup-5.0.0.exe.blockmap`（实测 121,155 B），但：项目无 `electron-updater` 依赖（更新逻辑自研，`electron/main.ts:1590-1652`）；`release.yml:142-145` 只上传 `*.exe`、`*.blockmap`、`checksums.sha256`，连 `latest.yml` 都没上传。blockmap 无消费者，latest.yml 无人下载。

### 改法
不改代码，记录二选一：接 `electron-updater` 做差分更新（省 ~100 MB/次下载），或关掉差分产物（推荐先做）。两个选项的动作与完成判据写在 DECISIONS D-002。**注意**：`.github/workflows/**` 与 `package.json` 不在本角色作用域，需由对应负责人执行。

### 验收命令（选项 2 实施后）
```bash
cd ClipMaster
npm run build && ls release/*.blockmap 2>/dev/null || echo "no blockmap generated"
```

---

## R-006 `docs/release-checksums/v1.0.0.sha256` 与当前命名不一致

**状态**：已修复（新增格式规范；历史文件保持原样）｜ **优先级**：P2

### 问题
归档文件名 `ClipMaster Setup 1.0.0.exe`（空格）与当前 `artifactName: "${productName}-Setup-${version}.${ext}"`（实测 `ClipMaster-Setup-5.0.0.exe`，连字符）不一致；且只有 1.0.0 一个版本归档，1.0.0 之后的校验和只在 Release 资产里。

### 证据
`docs/release-checksums/v1.0.0.sha256:1` 内容为
`0F0625E49F858DB6EE6D4A99614855DE6C36F6E984C99FE207DBE53969C1067F  ClipMaster Setup 1.0.0.exe`。

### 改法
新增 `docs/release-checksums/README.md`：写明当前格式（`<64 位大写 SHA256>␠␠<Release 资产名逐字一致>`、ASCII、LF）、生成命令、以及**历史归档不可回改**的理由（归档的意义是证明当时发布了什么，改写等于伪造历史）。

不重命名 `v1.0.0.sha256`，也不新建 `v5.0.0.sha256`——本轮没有拿到 v5.0.0 Release 的真实资产哈希（本地实测构建的哈希来自本机重打包，与线上资产不是同一份文件，写进去就是造假）。

### 验收命令
```bash
cd ClipMaster
cat docs/release-checksums/README.md | head -20
ls docs/release-checksums/          # v1.0.0.sha256 仍在，文件名未变
```

---

## R-007 `%TEMP%` 中的更新安装包永不清理

**状态**：未修（仅记录）｜ **优先级**：P2 ｜ 详见 [DECISIONS.md D-003](./DECISIONS.md#d-003-temp-中的安装包永不清理未修超出本角色作用域)

- 证据：`electron/main.ts:1514` 下载目标 `app.getPath('temp')/ClipMaster-Setup-<version>.exe`；`:1577`、`:1581` 只在哈希校验失败时删除。
- 影响：每次升级在用户 `%TEMP%` 留下约 114 MB 的安装包，无提示、不清扫。
- 未修原因：`electron/**` 不在本角色写作用域。修复动作与判据见 D-003，交由后端/架构角色执行。

---

## 附录 A：证书忽略规则实测输出

测试方式：在仓库根造 3 个假文件，确认它们**不出现**在未跟踪列表，然后删除。

```text
$ printf 'fake-pfx-bytes-for-gitignore-test' > test-cert.pfx
$ printf 'fake' > ClipMaster-CodeSigning.pfx.b64
$ printf 'fake' > test.key

$ git check-ignore -v test-cert.pfx ClipMaster-CodeSigning.pfx.b64 test.key
.gitignore:36:*.pfx     test-cert.pfx
.gitignore:40:*.b64     ClipMaster-CodeSigning.pfx.b64
.gitignore:39:*.key     test.key

$ git status --short --untracked-files=all
 M .gitignore
 M docs/CODE_SIGNING.md
 M package-lock.json
 M package.json

$ rm -f test-cert.pfx ClipMaster-CodeSigning.pfx.b64 test.key
$ git status --short --untracked-files=all
 M .gitignore
 M docs/CODE_SIGNING.md
 M package-lock.json
 M package.json
```

**结论**：三个假证书文件在 `--untracked-files=all` 下**完全未出现**，`check-ignore` 显示命中的正是新增规则行。测试文件已删除，工作区无残留。

> 注：`M package.json` / `M package-lock.json` 出现在上面的输出里，但**不是本轮改动**——`package.json` 由另一角色在同一工作区修改，`package-lock.json` 在整改开始前即为已修改状态。

---

## 附录 B：`installer.nsi` 删除前后 `git grep` 对比

删除前（HEAD `831c884` 中的引用，全部位于即将删除的文件内部）：

```text
$ git grep -nE "header\.bmp|welcome\.bmp" HEAD
HEAD:installer/installer.nsi:36:!define MUI_HEADERIMAGE_BITMAP "installer\header.bmp"
HEAD:installer/installer.nsi:40:!define MUI_WELCOMEFINISHPAGE_BITMAP "installer\welcome.bmp"
HEAD:scripts/generate-installer-assets.js:100:  fs.writeFileSync(path.join(installerDir, 'header.bmp'), headerBmp)
HEAD:scripts/generate-installer-assets.js:101:  console.log('✓ Generated header.bmp')
HEAD:scripts/generate-installer-assets.js:109:  fs.writeFileSync(path.join(installerDir, 'welcome.bmp'), welcomeBmp)
HEAD:scripts/generate-installer-assets.js:110:  console.log('✓ Generated welcome.bmp')

$ git ls-tree -r --name-only HEAD -- installer scripts
  installer/header.bmp
  installer/installer.nsi
  installer/welcome.bmp
  scripts/generate-icon.js
  scripts/generate-installer-assets.js
  scripts/install-dependencies.ps1
  scripts/verify-authenticode.ps1
```

删除后（工作区）：

```text
$ git grep -nE "installer\.nsi|makensis|header\.bmp|welcome\.bmp|generate-installer-assets"
  NO MATCHES

$ ls scripts
generate-icon.js
install-dependencies.ps1
verify-authenticode.ps1

$ git status --short
 M .gitignore
 M docs/CODE_SIGNING.md
 D installer/header.bmp
 D installer/installer.nsi
 D installer/welcome.bmp
 M package-lock.json
 M package.json
 D scripts/generate-installer-assets.js
```

**结论**：删除后全仓（含 `README*.md`、`docs/`、`package.json`、workflows）**零残留引用**，不存在文档断裂或构建断裂；`package.json` 里 `installerIcon`/`uninstallerIcon`/`installerHeaderIcon` 指向的是 `public/icon.ico`，与 `installer/` 目录无关，不受影响。

---

## 附录 C：本轮未执行的事项（如实记录）

| 事项 | 原因 |
| --- | --- |
| `git commit` | 按要求不提交，改动留在工作区由主理人统一处理 |
| `npm run build` | 按要求本轮不跑；回归验证需在合并后由 CI 或维护者执行（上一轮体检时 `npm run build` 实测 exit 0，产出两个 exe） |
| `.github/workflows/**` 的 blockmap 上传项 | 不在本角色作用域，见 R-005 |
| `package.json` 的 `differentialPackage` | 不在本角色作用域，见 R-005 |
| `electron/main.ts:1514` 的 `%TEMP%` 清理 | 不在本角色作用域，见 R-007/R-003 |
| 新建 `v5.0.0.sha256` 归档 | 未取得线上 Release 真实资产哈希，不伪造 |

---

## 给维护者的一页验收清单

```bash
cd ClipMaster

# 1. 证书规则（R-001）
printf 'x' > t.pfx && git status --short --untracked-files=all | grep t.pfx ; rm -f t.pfx
#    期望：grep 无输出（文件被忽略）

# 2. 文档不再引导放仓库内（R-002）
grep -n '\.\\\\ClipMaster-CodeSigning' docs/CODE_SIGNING.md
#    期望：无输出

# 3. 死安装器已清除（R-003）
git grep -nE "installer\.nsi|makensis" ; echo "exit=$?"
#    期望：无输出，exit=1

# 4. 脚本注释已更新（R-004）
head -8 build-installer.bat

# 5. 决策与格式文档存在（R-005/R-006）
ls docs/DECISIONS.md docs/release-checksums/README.md docs/REMEDIATION.md

# 6. 安装包仍能正常产出（需联网/依赖就绪，CI 主要保障）
npm run build && ls release/*.exe
```

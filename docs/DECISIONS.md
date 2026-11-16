# 构建与发布决策记录（DECISIONS）

本文件记录 ClipMaster 在 Windows 构建/发布链路上的**已执行决策**和**待定决策**。
每条决策给出：结论、决策理由、证据、影响范围、复现方式。执行记录见 [REMEDIATION.md](./REMEDIATION.md)。

- 基准 commit：`831c884`（branch `main`）
- 记录日期：2026-10-26
- 维护者：DSH 运维评审角色（整改仅涉及 `.gitignore`、`installer/**`、`docs/**`、`scripts/**`、`build*.bat`）

---

## D-001 移除从未进入构建链的自研 NSIS 脚本（已执行）

**状态**：已执行（删除）｜**优先级**：P1｜**类型**：技术债清理

### 结论

删除 `installer/installer.nsi`、`installer/header.bmp`、`installer/welcome.bmp`、`scripts/generate-installer-assets.js`。
Windows 安装包**唯一来源**是 `electron-builder`（`package.json` → `build.win.target = ["nsis", "portable"]`）。

### 为什么选删除而不是"纳入 CI"（方案 A vs B）

| 判断项 | 事实 | 结论 |
| --- | --- | --- |
| 是否参与构建 | `build.bat:7`、`build-installer.bat:10` 都只 `call npm run build`；全仓 `git grep -E "makensis\|installer.nsi"` 无任何命中 | 从未被编译，属死代码 |
| 产物是否已存在 | `npm run build` 实测产出 `ClipMaster-Setup-5.0.0.exe` 与 `ClipMaster-Portable-5.0.0.exe` | 已有可用安装包，nsi 属重复定义 |
| 语义是否一致 | nsi `:11` `InstallDir "$PROGRAMFILES\ClipMaster"` + `:13` `RequestExecutionLevel admin`；electron-builder 实测 `perMachine=false`（per-user） | 两者权限模型互斥，无法"并存" |
| 修好它需要多少工作 | 至少要改权限模型、修 `:46` 失效链接、重排 `:201-205` 页面、实现真实进度（当前 `:113-154` 进度条是假的）、处理 `:242-244` 无条件自启，再接入 CI 并与 electron-builder 产物互斥 | 成本远高于收益，且会造成"两套安装器"长期维护负担 |

因此采用**方案 A：删除**。方案 B（nsi 成为唯一安装包来源、electron-builder 只出 portable）被否决，原因不是"做不到"，而是它要在没有额外用户价值的前提下重新实现一遍 electron-builder 已经稳定工作的能力。

### 被删文件的语义缺陷（作为删除依据存档）

| 位置 | 问题 |
| --- | --- |
| `installer/installer.nsi:46` | 官网页链接写成 `https://github.com/clipmaster`，与实际仓库 `dhadb/ClipMaster` 不符 |
| `installer/installer.nsi:201-205` | `MUI_PAGE_WELCOME` 与自绘 `ShowWelcomePage` 并存，欢迎页重复出现两次 |
| `installer/installer.nsi:113-154` | 自绘进度条无定时器、无实际进度：文件在离开该页后才由 `:219` 复制，用户看到的是假进度 |
| `installer/installer.nsi:242-244` | 注释写 "optional"，实际无条件写 `HKCU\...\CurrentVersion\Run` 自启，无勾选项 |
| `installer/installer.nsi:89-103,148,168` | 用 `✦`/`●○`/`✓` 字符当功能图标（团队 P0 规则：禁止 emoji/字符作功能图标） |
| `installer/installer.nsi:31-32,142-145` | 硬编码颜色 `0x1A1B1E`、`0xC1C2C5`、`0x4C6EF5`（团队 P0 规则：禁止硬编码颜色） |

### 恢复方式

该文件仍可从历史取回：

```powershell
git show 831c884:installer/installer.nsi > installer.nsi
```

如未来确实需要自定义安装器 UI，建议基于 electron-builder 的 `nsis.include` / `nsis.script` 扩展点，而不是自建第二套安装器。

---

## D-002 `latest.yml` 与 `*.blockmap`：接差分更新，还是删掉（待定）

**状态**：决策记录（本次不改代码/工作流）｜**优先级**：P2

### 现状证据

- `npm run build` 实测会生成 `release/latest.yml`（含 `version: 5.0.0`、`sha512`、`releaseDate`）和 `ClipMaster-Setup-5.0.0.exe.blockmap`（121,155 B）。
- `package.json` 依赖里**没有** `electron-updater`（依赖仅 `date-fns`/`lucide-react`/`pinyin-pro`/`react`/`react-dom`/`safe-regex2`/`zustand`），更新逻辑是自研的：`electron/main.ts:1590-1652` 走 GitHub API + HTML 回退，`:1472-1480` 拼接 `checksums.sha256` 校验。
- `.github/workflows/release.yml:142-145` 上传的是 `release/*.exe`、`release/*.blockmap`、`release/checksums.sha256`，**没有上传 `latest.yml`**。

结论：`blockmap` 被上传但没有任何消费者（自研更新器整包下载 114 MB，不做差分）；`latest.yml` 被生成但连上传都没有。两者当前都是纯冗余产物。

### 二选一（需维护者拍板）

**选项 1：接入 `electron-updater` 做差分更新**
- 收益：增量下载可把单次升级从 ~114 MB 降到 ~1-10 MB（blockmap 即为此服务）。
- 代价：需改造自研更新链路（`electron/main.ts:1464-1677` 整段）、引入新依赖与签名校验路径变更、`latest.yml` 必须上传，且更新源需 `publish` 配置。
- 完成判据：`package.json` 出现 `electron-updater` 与 `build.publish`；`release.yml` 上传 `latest.yml`；实测从 5.0.0 → 5.1.0 的下载量 < 20 MB。

**选项 2：删掉这两个产物（推荐先做）**
- 动作：`package.json`（Lead 作用域）加 `build.nsis.differentialPackage = false`，并调整 `release.yml` 不再上传 `*.blockmap`；`latest.yml` 不生成或不上传。
- 收益：Release 页面少两个无意义文件，用户不再困惑"这个 .blockmap 要不要下"。
- 完成判据：`npm run build` 后 `release/` 内不再出现 `.blockmap`；Release 资产仅 `.exe` + `checksums.sha256`。

**建议**：先执行选项 2（成本 5 分钟），把差分更新放进 P2 路线图再评估——114 MB 的下载量在桌面工具场景尚可接受，而改造更新链路的回归风险更高。

---

## D-003 `%TEMP%` 中的安装包永不清理（未修，超出本角色作用域）

**状态**：未修（仅记录）｜**优先级**：P2

- 证据：`electron/main.ts:1514` 下载目标固定为 `path.join(app.getPath('temp'), \`ClipMaster-Setup-${info.latestVersion}.exe\`)`；`:1577` 与 `:1581` 只在**校验失败**时删除，成功安装后不清理。
- 影响：每升级一个版本，用户 `%TEMP%` 留下一个 ~114 MB 的安装包，长期累积数百 MB 且无提示。
- 修复建议（由后端/架构角色在 `electron/main.ts` 执行）：安装成功或启动时清理 `%TEMP%/ClipMaster-Setup-*.exe`，保留最近一个版本；或改用 `app.getPath('userData')/updates` 并在 `cleanupImageCache` 同类逻辑中做保留策略。
- 完成判据：连续升级两次后 `%TEMP%` 内 `ClipMaster-Setup-*.exe` 数量 ≤ 1。

---

## D-004 `docs/release-checksums/` 归档格式规范化（已执行）

**状态**：已执行（新增说明，历史文件不可回改）｜**优先级**：P2

- 问题：`docs/release-checksums/v1.0.0.sha256` 内容为
  `0F0625E4...1067F  ClipMaster Setup 1.0.0.exe`，文件名**含空格**；
  而当前 `package.json` 的 `nsis.artifactName` 是 `${productName}-Setup-${version}.${ext}`（连字符），实测产物名为 `ClipMaster-Setup-5.0.0.exe`。
- 处理：历史文件保持原样（它记录的是当时真实的 1.0.0 产物名，改写等于伪造历史），改为在同目录新增 `README.md` 说明当前格式规范与历史差异。
- 完成判据：`docs/release-checksums/README.md` 存在且说明格式；后续版本归档文件名与 `artifactName` 一致。

---

## D-005 签名证书与私钥的忽略规则（已执行）

**状态**：已执行｜**优先级**：P0

- 问题：`.gitignore` 原第 27-32 行只忽略 `.env*`，而 `docs/CODE_SIGNING.md` 曾指导把 PFX 放在工作目录做本地签名，`git add .` 会直接提交证书。
- 处理：`.gitignore` 新增 `*.pfx *.p12 *.pem *.key *.b64 *.cer *.crt *.pvk certificates/ secrets/`；`docs/CODE_SIGNING.md` 改为统一使用仓库外目录 `%USERPROFILE%\.clipmaster-signing\`。
- 说明：`.gitignore` 只对未跟踪文件生效；仓库历史中从未出现证书（`git log --all` 全历史扫描无命中），因此无需清理历史。

---

## D-006 更新链 fail-closed：下载校验 + 安装前复校（已执行）

**状态**：已执行｜**优先级**：P0｜**类型**：安全加固

### 结论

1. 更新包必须有 SHA256 校验值：取不到 `checksums.sha256`、或文件里没有对应文件名，**直接失败**，不存在"跳过校验继续装"的降级路径。
2. 校验做两次：下载落盘后一次，**点安装时再一次**（对 `%TEMP%` 里的文件重新计算并与下载时记录的值比对），不一致就删包并拒绝安装。
3. 暂不启用 Authenticode 签名：没有 OV/EV 证书，签名开关 `ENABLE_WINDOWS_CODE_SIGNING` 保留，拿到证书后无需改代码即可开启。

### 理由

- 未签名时 SHA256 是唯一的完整性来源，fail-closed 才能把"拿到什么就装什么"的窗口关掉。
- 下载校验只覆盖"下载那一刻"；用户可能隔很久才点安装，期间 `%TEMP%` 里的文件可被替换。复校成本是 114 MB 一次哈希（约 0.3 s），换的是"点安装时包的完整性"，值得。
- 不给无证书的包做"假签名"或"跳过校验"，因为那会把安全性降到和没有更新机制一样，却让用户以为有。

### 证据与完成判据

- `electron/main.ts`：`getExpectedUpdateHash`（缺校验值抛错）、`downloadInstaller`（落盘后比对、失败删包）、`install-update`（安装前复校，先于 `shell.openPath`）。
- `src/utils/releaseSafetyContract.test.ts`：4 条源码契约守卫，禁止上述任一路径被改回 fail-open。
- 门禁：`typecheck` 0 错误、`vitest` 全绿、`lint` 0 error。

### 影响范围

`install-update` 多一次磁盘哈希；失败提示改为"checksum verification before install"。无 UI 变更。

---

## D-007 卸载保留用户数据（已执行，产品决定）

**状态**：已执行｜**优先级**：P1｜**类型**：产品取舍

### 结论

`build.nsis.deleteAppDataOnUninstall = false`：**卸载不删除** `%AppData%/ClipMaster/`（历史、设置、图片缓存都保留）。重装后数据还在。

### 理由

- 剪贴板历史是用户不可再生的数据（复制过的东西不会回来），静默删除属于不可逆伤害；误点卸载的代价远大于"留几百 KB 残留"。
- NSIS 卸载是用户最不设防的破坏性操作之一，默认值应当保守。

### 代价与补偿

- 代价：卸载后残留数据，用户若想要"干净移除"需要手动删目录。
- 补偿：`PRIVACY.md` 的 *Clearing Data* 已写明卸载不删数据、如何手动删除；不再让用户以为卸载=清除。

### 完成判据

`package.json` 中该字段为 `false`；`PRIVACY.md` 含卸载说明；安装/卸载实测后 `%AppData%/ClipMaster/` 仍存在。

---

## D-008 v5 不引入账号、云同步与付费额度墙（产品决定，不改代码）

**状态**：决策已定，不执行代码｜**优先级**：P2｜**类型**：产品取舍

### 结论

v5.0.0 保持 local-first：不做账号体系、不做跨设备同步、不做免费版功能额度墙。

### 理由

- 现有 `PRIVACY.md` 明确承诺"不上传、不同步、不分析剪贴板内容"。云同步会把这条承诺整体推翻，需要服务端、账号、合规、密钥管理一整套设施，成本远大于 v5 剩余时间窗。
- 剪贴板工具的核心价值是"本地零延迟 + 隐私"，同步是另一个产品问题，不该顺手塞进 v5。
- 没有云端就没有额度墙的意义：本地功能不存在边际成本，人为设限只会削弱口碑。

### 如果未来要做

需要独立的产品决策与设计文档：账号与密钥、端到端加密方案、冲突合并策略、服务端成本模型，并重写 `PRIVACY.md`。届时按新版本处理，不回头改 v5 的承诺。

---

## D-003 补记：`%TEMP%` 历史安装包清理已收口

原 D-003（每升级一次在 `%TEMP%` 留一个 ~114 MB 安装包）已按建议实现：启动时 `cleanupStaleInstallers()` 删除 `%TEMP%/ClipMaster-Setup-<version>.exe`，失败静默。连续升级两次后残留 ≤ 1 的判据可在本机验证。

---

## D-009 传递依赖钉版（npm overrides）与 lockfile 一致性门禁（已执行）

**状态**：已执行｜**优先级**：P2｜**类型**：供应链加固

### 结论

`package.json` 的 `overrides` 对四个**传递依赖**做精确钉版：

| 包 | 钉版 | 传递来源（npm ls 实测） |
| --- | --- | --- |
| `fast-uri` | `4.1.4` | `app-builder-lib → ajv@8.20.0 → fast-uri` |
| `js-yaml` | `4.3.1` | `app-builder-lib`、`builder-util`、`dmg-builder`、`@eslint/eslintrc` |
| `nanoid` | `3.3.18` | `postcss@8.5.23` |
| `undici` | `7.29.0` | `electron → @electron/get@5.0.0`、`node-gyp` |

四包均无直接依赖入口（无法通过升级顶层依赖解决），因此使用 npm 官方 overrides 机制统一钉到安全版本；`npm ls` 已确认 `overridden` 生效。新增 `scripts/check-overrides.mjs` 门禁（CI 在 lint 之后调用）：比对 overrides 与 `package-lock.json` 根级解析版本、以及 `node_modules` 实际安装版本，不一致即失败（退出码 1），防止 lockfile 漂移导致钉版静默失效。

### 为什么钉版：npm audit 证据（2026-11-15，官方 registry 实测）

- **运行时依赖**（`npm audit --omit=dev --audit-level=high`）：`found 0 vulnerabilities`。
- **完整依赖树**（含 dev/build 工具链）：24 vulnerabilities（17 moderate, 7 high），全部位于构建链，不进入安装包运行时。

钉版依据的已知通告（GitHub Advisory Database）：

| 包 | 钉版时针对的通告 | 钉版时状态 |
| --- | --- | --- |
| `fast-uri` | CVE-2026-110306（GHSA-w74x-v6f9-j3xg，scheme 欺骗）、CVE-2026-110095（GHSA-xhq7-xmqj-769h，路径等价绕过）、CVE-2026-110180（GHSA-wjr9-j795-jxcr，host 混淆） | 修复版本为 4.2.x 系列 |
| `js-yaml` | CVE-2026-84375（GHSA-2883-xcg3-v3hh，merge key CPU DoS）、GHSA-5p4m-2wfm-xmqj（!!omap 二次方 CPU 消耗） | 修复版本为 4.3.1+ |
| `nanoid` | CVE-2026-73086（GHSA-xwg4-73v4-xw9w，整数溢出）、CVE-2026-67214（GHSA-28wg-ghj8-5hjv，负 size 死循环）、CVE-2026-67213（GHSA-2v37-7h3g-55p8，零 size 死循环） | 3.3.18 已全部覆盖 |
| `undici` | CVE-2026-109829（GHSA-4w7w-5xrc-9h26，缓存污染/跨用户信息泄露）、CVE-2026-109383（GHSA-2m5v-pch6-74hx，TLS 校验绕过）、CVE-2026-87018（GHSA-qrxm-fqhp-jwvm，TLS 1.2 重协商 DoS） | 修复版本为 7.30.x 系列 |

### ⚠️ 已知残留与后续跟进（待办，非本决策完成项）

钉版之后生态又发布了新通告，当前 audit 对**钉版后版本**仍报 high（这是本决策记录如实留痕）：

- `fast-uri@4.1.4` 落在新通告的易受影响区间（4.0.0–4.2.2，含 mailto header 注入 GHSA-jvvf-x445-j334 等 6 条），修复版 **4.2.3**。
- `js-yaml@4.3.1` 受 CVE-2026-84375 影响（< 4.3.2），修复版 **4.3.2**。
- `undici@7.29.0` 落在 7.0.0–7.30.0 区间（17 条 high 通告），修复版 **7.30.1**。

跟进动作：把 overrides 升到 `fast-uri@4.2.3`、`js-yaml@4.3.2`、`undici@7.30.1` 并 `npm install` 刷新 lockfile（`check-overrides.mjs` 会强制两者一致，防止只改一边）。`npm audit fix --force` 建议的 `electron-builder@24.13.3` 降级**不采纳**（破坏性变更，收益倒挂）。

### 影响范围

- `package.json`（overrides 与 `scripts.check-overrides` 无新增运行时依赖）、`scripts/check-overrides.mjs`（新增，Node 22 直接运行）、`build.yml`/`release.yml`（lint 后新增 `Check dependency overrides match lockfile` 步骤）。
- 审计常态化：两个 workflow 的 `npm audit` 步骤改为 `continue-on-error: true` 非阻塞，并把高风险摘要写入 job summary（避免基线未清零前 CI 误红）；待上述跟进项落地、基线清零后可再提为阻塞门禁。

### 完成判据

- `node scripts/check-overrides.mjs` 通过（overrides = lockfile = node_modules 实装版本）。
- CI（build/release）在 lint 后执行 overrides 检查；audit 摘要出现在 job summary。
- 运行时依赖 audit 保持 0 vulnerabilities。

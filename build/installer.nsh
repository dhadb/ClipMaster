; ClipMaster NSIS 自定义脚本（electron-builder nsis.include 注入，见 package.json build.nsis.include）。
;
; 功能：在卸载流程中提供"同时删除剪贴板历史"复选框（%APPDATA%\ClipMaster，
; 含历史、设置与图片缓存）。默认不勾选 —— 卸载保留用户数据（决策 D-007），
; 用户显式勾选后才在卸载时删除该目录。
;
; 生效机制：本文件在 installer.nsi 模板正文之前被 include（见 app-builder-lib
; NsisTarget.computeCommonInstallerScriptHeader），其中定义的 !macro 会被
; assistedInstaller.nsh（oneClick=false 路径）与 uninstaller.nsh 的
; !ifmacrodef 探测并插入：
;   - customUnWelcomePage  -> 卸载页面声明区（MUI_UNPAGE_INSTFILES 之前）
;   - customUnInstall      -> 卸载 Section 内（文件删除之后执行）
;
; 编码要求：本文件必须带 UTF-8 BOM（NSIS 3 依 BOM 识别 UTF-8，否则中文会乱码）。
;
; 注意：NSIS 脚本无法在本机编译验证，打包产物需人工执行安装/卸载确认页面与
; 删除行为（见 CONTRIBUTING.md / 任务报告）。

Var ClipMasterDeleteDataCheckbox  ; 复选框控件句柄
Var ClipMasterDeleteDataChecked   ; "0"=保留（默认） / "1"=删除

; 卸载页声明：先保留默认欢迎页，再插入本项目的数据清理页（早于 INSTFILES，
; 保证勾选发生在卸载 Section 执行之前）。
!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
  UninstPage custom un.ClipMasterDataPageCreate un.ClipMasterDataPageLeave
!macroend

; 卸载"清理数据"自定义页：nsDialogs 复选框，默认不勾选。
Function un.ClipMasterDataPageCreate
  !insertmacro MUI_HEADER_TEXT "清理本机数据" "可选择在卸载时是否同时删除剪贴板历史等本机数据。默认保留。"
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateCheckbox} 0 0 100% 24u "同时删除剪贴板历史（$APPDATA\ClipMaster）"
  Pop $ClipMasterDeleteDataCheckbox
  ${NSD_SetState} $ClipMasterDeleteDataCheckbox ${BST_UNCHECKED}
  nsDialogs::Show
FunctionEnd

; 离开页面时读取勾选状态，供 customUnInstall 使用。
Function un.ClipMasterDataPageLeave
  ${NSD_GetState} $ClipMasterDeleteDataCheckbox $ClipMasterDeleteDataChecked
FunctionEnd

; 卸载 Section 内执行：仅在用户显式勾选时删除用户数据目录。
!macro customUnInstall
  ${if} $ClipMasterDeleteDataChecked == 1
    DetailPrint "Deleting clipboard history data: $APPDATA\ClipMaster"
    RMDir /r "$APPDATA\ClipMaster"
  ${endIf}
!macroend

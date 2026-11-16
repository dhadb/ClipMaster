; ClipMaster NSIS 自定义脚本（electron-builder nsis.include 注入，见 package.json build.nsis.include）。
;
; 功能：卸载结束时询问是否同时删除剪贴板历史等本机数据（%APPDATA%\ClipMaster，
; 含历史、设置与图片缓存）。默认不删除 —— 卸载保留用户数据（决策 D-007），
; 用户在卸载过程中选择"是"后才删除该目录。
;
; 生效机制：本文件在 installer.nsi 模板正文之前被 include（见 app-builder-lib
; NsisTarget.computeCommonInstallerScriptHeader）；Function 体在 include 时即编译，
; 故不可使用 MUI2/nsDialogs/LogicLib（其 include 位于模板正文）。因此本文件只
; 定义 customUnInstall 宏（由 uninstaller.nsh 在卸载 Section 内 !ifmacrodef 探测
; 并延迟展开），且仅使用 NSIS 核心指令。
;
; 编码要求：本文件必须带 UTF-8 BOM（NSIS 3 依 BOM 识别 UTF-8，否则中文会乱码）。
;
; 注意：NSIS 脚本无法在本机编译验证，打包产物需人工执行安装/卸载确认页面与
; 删除行为（见 CONTRIBUTING.md / 任务报告）。

; 卸载 Section 内执行（uninstaller.nsh 延迟展开，此时 MUI2/LogicLib 均已可用）：
; 询问是否同时删除本机数据，仅在选择"是"时删除。使用 NSIS 核心指令，兼容性最好。
!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时删除剪贴板历史等本机数据？$\n$\n位置：$APPDATA\ClipMaster$\n选择“否”将保留数据（默认行为）。" IDYES clipmaster_delete_data_yes
  Goto clipmaster_delete_data_done
  clipmaster_delete_data_yes:
    DetailPrint "Deleting clipboard history data: $APPDATA\ClipMaster"
    RMDir /r "$APPDATA\ClipMaster"
  clipmaster_delete_data_done:
!macroend

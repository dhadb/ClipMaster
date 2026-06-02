; ClipMaster Custom Installer Script
; Modern, animated installation experience

!include "MUI2.nsh"
!include "WinMessages.nsh"
!include "nsDialogs.nsh"

; ===== General =====
Name "ClipMaster"
OutFile "..\release\ClipMaster-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES\ClipMaster"
InstallDirRegKey HKCU "Software\ClipMaster" ""
RequestExecutionLevel admin

; ===== Version Info =====
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "ClipMaster"
VIAddVersionKey "CompanyName" "ClipMaster Team"
VIAddVersionKey "FileDescription" "Modern Clipboard Manager"
VIAddVersionKey "FileVersion" "${VERSION}"

; ===== Branding =====
BrandingText "ClipMaster - 现代剪贴板管理器"

; ===== MUI Settings =====
!define MUI_ABORTWARNING
!define MUI_ICON "..\public\icon.ico"
!define MUI_UNICON "..\public\icon.ico"

; Custom colors
!define MUI_BGCOLOR "0x1A1B1E"
!define MUI_TEXTCOLOR "0xC1C2C5"

; Header image
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "installer\header.bmp"
!define MUI_HEADERIMAGE_RIGHT

; Welcome/Finish sidebar image
!define MUI_WELCOMEFINISHPAGE_BITMAP "installer\welcome.bmp"

; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\ClipMaster.exe"
!define MUI_FINISHPAGE_RUN_TEXT "启动 ClipMaster"
!define MUI_FINISHPAGE_LINK "访问 ClipMaster 官网"
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/clipmaster"

; ===== Variables =====
Var Dialog
Var HeaderLabel
Var DescLabel
Var Icon
Var ProgressBar
Var StepLabel
Var DotTimer
Var DotCount

; ===== Custom Page Functions =====
Function ShowWelcomePage
  ; Create custom welcome page
  nsDialogs::Create 1018
  Pop $Dialog

  ${If} $Dialog == error
    Abort
  ${EndIf}

  ; Background color
  ${NSD_SetBackground} $Dialog 0x1A1B1E

  ; App icon
  ${NSD_CreateIcon} 20u 20u 48u 48u ""
  Pop $Icon
  ${NSD_SetIconFromInstaller} $Icon $MUI_ICON

  ; Title
  ${NSD_CreateLabel} 80u 20u 200u 20u "欢迎安装 ClipMaster"
  Pop $HeaderLabel
  SetCtlColors $HeaderLabel 0xFFFFFF 0x1A1B1E
  CreateFont $0 "Segoe UI" 16 700
  SendMessage $HeaderLabel ${WM_SETFONT} $0 0

  ; Subtitle
  ${NSD_CreateLabel} 80u 40u 200u 15u "现代化 Windows 剪贴板管理器"
  Pop $DescLabel
  SetCtlColors $DescLabel 0x909296 0x1A1B1E

  ; Features list
  ${NSD_CreateLabel} 30u 75u 250u 12u "✦ 实时监控剪贴板内容变化"
  Pop $0
  SetCtlColors $0 0xC1C2C5 0x1A1B1E

  ${NSD_CreateLabel} 30u 90u 250u 12u "✦ 智能识别文本、链接、代码等类型"
  Pop $0
  SetCtlColors $0 0xC1C2C5 0x1A1B1E

  ${NSD_CreateLabel} 30u 105u 250u 12u "✦ 快速搜索和收藏管理"
  Pop $0
  SetCtlColors $0 0xC1C2C5 0x1A1B1E

  ${NSD_CreateLabel} 30u 120u 250u 12u "✦ 全局快捷键一键唤起"
  Pop $0
  SetCtlColors $0 0xC1C2C5 0x1A1B1E

  ; Version info
  ${NSD_CreateLabel} 30u 145u 250u 12u "版本 ${VERSION}"
  Pop $0
  SetCtlColors $0 0x5C5F66 0x1A1B1E

  nsDialogs::Show
FunctionEnd

Function ShowInstallPage
  ; Create custom install progress page
  nsDialogs::Create 1018
  Pop $Dialog

  ${If} $Dialog == error
    Abort
  ${EndIf}

  ${NSD_SetBackground} $Dialog 0x1A1B1E

  ; Icon
  ${NSD_CreateIcon} 20u 20u 32u 32u ""
  Pop $Icon
  ${NSD_SetIconFromInstaller} $Icon $MUI_ICON

  ; Title
  ${NSD_CreateLabel} 60u 22u 200u 18u "正在安装 ClipMaster"
  Pop $HeaderLabel
  SetCtlColors $HeaderLabel 0xFFFFFF 0x1A1B1E
  CreateFont $0 "Segoe UI" 14 700
  SendMessage $HeaderLabel ${WM_SETFONT} $0 0

  ; Step label
  ${NSD_CreateLabel} 60u 42u 200u 12u "准备安装..."
  Pop $StepLabel
  SetCtlColors $StepLabel 0x909296 0x1A1B1E

  ; Progress bar
  ${NSD_CreateProgressBar} 20u 65u 260u 16u ""
  Pop $ProgressBar
  SendMessage $ProgressBar ${PBM_SETBARCOLOR} 0 0x4C6EF5
  SendMessage $ProgressBar ${PBM_SETBKCOLOR} 0 0x2C2E33

  ; Status dots animation
  ${NSD_CreateLabel} 20u 85u 260u 12u "●○○○○"
  Pop $DotTimer
  SetCtlColors $DotTimer 0x4C6EF5 0x1A1B1E
  StrCpy $DotCount 0

  nsDialogs::Show
FunctionEnd

Function ShowFinishPage
  ; Create custom finish page
  nsDialogs::Create 1018
  Pop $Dialog

  ${If} $Dialog == error
    Abort
  ${EndIf}

  ${NSD_SetBackground} $Dialog 0x1A1B1E

  ; Success icon (using checkmark)
  ${NSD_CreateLabel} 120u 30u 60u 60u "✓"
  Pop $0
  SetCtlColors $0 0x20C997 0x1A1B1E
  CreateFont $0 "Segoe UI" 36 700
  SendMessage $0 ${WM_SETFONT} $0 0

  ; Success title
  ${NSD_CreateLabel} 60u 95u 180u 20u "安装完成！"
  Pop $HeaderLabel
  SetCtlColors $HeaderLabel 0xFFFFFF 0x1A1B1E
  CreateFont $0 "Segoe UI" 18 700
  SendMessage $HeaderLabel ${WM_SETFONT} $0 0

  ; Description
  ${NSD_CreateLabel} 40u 115u 220u 15u "ClipMaster 已成功安装到您的电脑"
  Pop $DescLabel
  SetCtlColors $DescLabel 0x909296 0x1A1B1E

  ; Run checkbox
  ${NSD_CreateCheckbox} 40u 140u 220u 15u "立即启动 ClipMaster"
  Pop $0
  SetCtlColors $0 0xC1C2C5 0x1A1B1E
  ${NSD_Check} $0

  ; Tips
  ${NSD_CreateLabel} 40u 165u 220u 12u "提示: 使用 Ctrl+Shift+V 快速唤起"
  Pop $0
  SetCtlColors $0 0x5C5F66 0x1A1B1E

  nsDialogs::Show
FunctionEnd

; ===== Pages =====
!insertmacro MUI_PAGE_WELCOME
Page custom ShowWelcomePage
Page custom ShowInstallPage
Page custom ShowFinishPage
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "SimpChinese"

; ===== Sections =====
Section "Install"
  SetOutPath "$INSTDIR"

  ; Copy files
  File /r "..\release\win-unpacked\*.*"

  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\ClipMaster"
  CreateShortCut "$SMPROGRAMS\ClipMaster\ClipMaster.lnk" "$INSTDIR\ClipMaster.exe"
  CreateShortCut "$DESKTOP\ClipMaster.lnk" "$INSTDIR\ClipMaster.exe"

  ; Registry
  WriteRegStr HKCU "Software\ClipMaster" "" $INSTDIR
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClipMaster" \
    "DisplayName" "ClipMaster"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClipMaster" \
    "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClipMaster" \
    "DisplayIcon" "$\"$INSTDIR\ClipMaster.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClipMaster" \
    "Publisher" "ClipMaster Team"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClipMaster" \
    "DisplayVersion" "${VERSION}"

  ; Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Auto-start (optional)
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "ClipMaster" "$\"$INSTDIR\ClipMaster.exe$\""
SectionEnd

Section "Uninstall"
  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove shortcuts
  RMDir /r "$SMPROGRAMS\ClipMaster"
  Delete "$DESKTOP\ClipMaster.lnk"

  ; Remove registry
  DeleteRegKey HKCU "Software\ClipMaster"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClipMaster"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ClipMaster"
SectionEnd

; Custom NSIS configuration for CelyaVox installer
; This file is used by electron-builder to add custom post-installation hooks

!ifdef INSTALL
  Section "Install" Install
    ; Standard installation is handled by electron-builder
    ; This section can be used for custom post-install actions
  SectionEnd

  Section -post
    ; Execute post-installation script
    ; The postinstall_windows.ps1 script will be in $INSTDIR after installation
    SetOutPath "$INSTDIR"
    
    ; Call the PowerShell post-install script with the install directory as parameter
    ExecWait 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\postinstall_windows.ps1" -InstallDir "$INSTDIR"'
  SectionEnd
!endif

!ifdef UNINSTALL
  ; Uninstall is straightforward - no custom hooks needed
!endif

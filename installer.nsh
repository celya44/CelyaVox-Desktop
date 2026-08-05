; installer.nsh - Script personnalisé NSIS pour CelyaVox
; Ce fichier s'exécutera après l'installation

!ifdef INSTALL
  ; Code d'installation
  Section "PostInstall" PostInstall
    ; Exécuter le script batch de post-installation si l'utilisateur a accepté
    ${If} $0 == 0
      SetOutPath "$INSTDIR"
      ; Définir les variables d'environnement pour le script
      System::Call 'kernel32::SetEnvironmentVariable(t, t, t) i.s ("INSTALLER_PATH", "$INSTDIR", 1) ?!'
      
      ; Exécuter le script batch de post-installation
      ExecWait '"cmd.exe" /c "$INSTDIR\postinstall_windows.bat"'
    ${EndIf}
  SectionEnd
!endif

!ifdef UNINSTALL
  ; Code de désinstallation
  Section "un.PostUninstall" PostUninstall
    ; Rien de spécial pour la désinstallation
  SectionEnd
!endif

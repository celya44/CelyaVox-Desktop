@echo off
REM postinstall_windows.bat - Script post-installation pour Windows (NSIS)
REM Crée les répertoires de configuration et copie les fichiers de sample

setlocal enabledelayedexpansion

echo [postinstall] Début du script de post-installation
echo.

REM Déterminer si c'est une installation dev ou prod
set "PACKAGE_NAME=%INSTALLER_PACKAGE_NAME%"
if not defined PACKAGE_NAME (
    if "!INSTALLER_PATH!" == "" (
        set "PACKAGE_NAME=prod"
    ) else (
        echo !INSTALLER_PATH! | findstr /i "dev" >nul
        if !errorlevel! equ 0 (
            set "PACKAGE_NAME=dev"
        ) else (
            set "PACKAGE_NAME=prod"
        )
    )
)

REM Définir les chemins selon l'env
if "!PACKAGE_NAME!" == "dev" (
    set "CONFIG_DIR=%APPDATA%\CelyaVox-dev"
    set "BINARY_NAME=celyavox-dev"
) else (
    set "CONFIG_DIR=%APPDATA%\CelyaVox"
    set "BINARY_NAME=celyavox"
)

echo [postinstall] Configuration pour: !BINARY_NAME!
echo [postinstall] Répertoire utilisateur: !CONFIG_DIR!
echo.

REM Créer le répertoire de configuration s'il n'existe pas
if not exist "!CONFIG_DIR!" (
    mkdir "!CONFIG_DIR!"
    echo [postinstall] Répertoire créé: !CONFIG_DIR!
) else (
    echo [postinstall] Répertoire existe déjà: !CONFIG_DIR!
)
echo.

REM Chercher les fichiers de sample dans le répertoire d'installation
set "INSTALL_DIR=%INSTALLER_PATH%"

if not "!INSTALL_DIR!" == "" (
    echo [postinstall] Répertoire d'installation: !INSTALL_DIR!
    
    REM Copier config.ini.example s'il n'existe pas
    if exist "!INSTALL_DIR!\config.ini.example" (
        if not exist "!CONFIG_DIR!\config.ini" (
            copy "!INSTALL_DIR!\config.ini.example" "!CONFIG_DIR!\config.ini" >nul
            echo [postinstall] config.ini copié depuis example
        )
    )
    
    REM Copier sso.ini.example s'il n'existe pas
    if exist "!INSTALL_DIR!\sso.ini.example" (
        if not exist "!CONFIG_DIR!\sso.ini" (
            copy "!INSTALL_DIR!\sso.ini.example" "!CONFIG_DIR!\sso.ini" >nul
            echo [postinstall] sso.ini copié depuis example
        )
    )
) else (
    echo [postinstall] Répertoire d'installation non trouvé
)

echo.
echo [postinstall] Script de post-installation terminé
echo.

endlocal

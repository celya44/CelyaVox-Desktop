@echo off
REM postinstall_windows.bat - Script post-installation pour Windows (NSIS)
REM Note: Ce script s'exécute en tant qu'administrateur système
REM Les fichiers de configuration utilisateur seront créés par l'application 
REM au premier lancement, pas par le programme d'installation

setlocal enabledelayedexpansion
echo [postinstall] Installation de CelyaVox reussie
echo.
endlocal

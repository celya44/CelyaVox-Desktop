# postinstall_windows.ps1 - Script post-installation pour Windows (NSIS)
# Note: Ce script s'exécute en tant qu'administrateur système
# Les fichiers de configuration utilisateur seront créés par l'application 
# au premier lancement, pas par le programme d'installation

param(
    [string]$InstallDir = ""
)

Write-Host "[postinstall] Installation de CelyaVox réussie" -ForegroundColor Green

# Rien d'autre à faire - l'application crée les fichiers config au premier lancement

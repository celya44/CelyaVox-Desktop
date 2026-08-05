# postinstall_windows.ps1 - Script post-installation pour Windows (NSIS)
# Crée les répertoires de configuration et copie les fichiers de sample

param(
    [string]$InstallDir = ""
)

# Déterminer si c'est une installation dev ou prod
$PackageName = $env:INSTALLER_PACKAGE_NAME
if (-not $PackageName) {
    # Chercher dans le répertoire d'installation
    if ($InstallDir -like "*dev*") {
        $PackageName = "dev"
    } else {
        $PackageName = "prod"
    }
}

if ($PackageName -like "*dev*") {
    $ConfigDir = Join-Path $env:APPDATA "CelyaVox-dev"
    $BinaryName = "celyavox-dev"
} else {
    $ConfigDir = Join-Path $env:APPDATA "CelyaVox"
    $BinaryName = "celyavox"
}

Write-Host "🔧 [postinstall] Configuration pour: $BinaryName" -ForegroundColor Green
Write-Host "📁 [postinstall] Répertoire utilisateur: $ConfigDir" -ForegroundColor Green

# Créer le répertoire de configuration s'il n'existe pas
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    Write-Host "📁 [postinstall] Répertoire créé: $ConfigDir" -ForegroundColor Green
} else {
    Write-Host "ℹ️  [postinstall] Répertoire existe déjà: $ConfigDir" -ForegroundColor Gray
}

# Chercher les fichiers de sample dans le répertoire d'installation
if ($InstallDir -and (Test-Path $InstallDir)) {
    Write-Host "📦 [postinstall] Répertoire d'installation: $InstallDir" -ForegroundColor Green
    
    # Copier config.ini.example s'il n'existe pas
    $ConfigExample = Join-Path $InstallDir "config.ini.example"
    $ConfigPath = Join-Path $ConfigDir "config.ini"
    if ((Test-Path $ConfigExample) -and -not (Test-Path $ConfigPath)) {
        Copy-Item -Path $ConfigExample -Destination $ConfigPath
        Write-Host "✅ [postinstall] config.ini copié depuis example" -ForegroundColor Green
    }
    
    # Copier sso.ini.example s'il n'existe pas
    $SsoExample = Join-Path $InstallDir "sso.ini.example"
    $SsoPath = Join-Path $ConfigDir "sso.ini"
    if ((Test-Path $SsoExample) -and -not (Test-Path $SsoPath)) {
        Copy-Item -Path $SsoExample -Destination $SsoPath
        Write-Host "✅ [postinstall] sso.ini copié depuis example" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  [postinstall] Répertoire d'installation non trouvé" -ForegroundColor Yellow
}

Write-Host "✅ [postinstall] Script de post-installation terminé" -ForegroundColor Green

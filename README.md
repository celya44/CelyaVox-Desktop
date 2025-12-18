# CelyaVox - Electron Desktop Application

This project wraps a WebRTC SIP Phone application into an Electron desktop application
for Windows, macOS and Linux.

**Developed by:** CELYA (2025)  
**License:** GNU Affero General Public License v3.0 (AGPL-3.0)

**Note:** The Phone web application (located in `app/Phone/`) is based on [InnovateAsterisk/Browser-Phone](https://github.com/InnovateAsterisk/Browser-Phone)

## Features

- Secure `preload.js` bridge for IPC communication
- `main.js` Electron bootstrap with custom window management
- System tray integration with background operation
- Incoming call notification system with custom UI
- Single instance lock to prevent multiple app instances
- Enhanced media permissions handling for WebRTC
- Packaging configuration using `electron-builder` to produce installers
- Multi-platform support (Linux, Windows, macOS)

## Quick start
1. Clone this skeleton locally.
2. Inside the skeleton root:

```bash
# install deps
npm install

Attention se connecter avec l'option -X pour le forward du X
# start dev
npm start -- --no-sandbox
```

3. Build installers:

```bash
# build for your current platform (mac on macOS, Windows on Windows)
npm run dist
```

#Note: Building macOS .dmg must be done on macOS. Windows code signing / installer customizations are optional._

Si vous utilisez l'app image il faut faire un wraper pour ajouter --no-sandbox, ou lancer la commande ./CelyaVox-dev-1.0.0.AppImage --no-sandbox


## Rebuild Instructions

Pour rebuilder l'application :

```bash
changer le owner par dev:dev sur tous le répertoire
rm /opt/freepbx/www/electronapp/.cache/* -r
rm -r /opt/freepbx/www/electronapp/node_modules/*
npm install
npm audit fix
npm run dist
```

## Build Windows depuis Linux

**Important:** La génération de fichiers MSI depuis Linux n'est pas supportée par electron-builder car elle nécessite des outils Windows spécifiques (WiX Toolset).

Options disponibles :
- **NSIS (recommandé)** : Installeur Windows classique avec interface graphique
- **Portable** : Exécutable standalone sans installation

Pour générer un MSI, vous devez builder depuis Windows ou utiliser une VM/CI Windows.

Build disponibles depuis Linux :
```bash
npm run dist:linux   # AppImage, deb, rpm
npm run dist:win     # Portable exe (pas de MSI)
npm run dist:all     # Tous les formats disponibles
```

## License & Copyright

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

**Electron Application:** Copyright (C) 2025 CELYA <debian@celya.fr>  
**Phone Web App (app/Phone/):** Based on InnovateAsterisk/Browser-Phone, modified by CELYA

See the [COPYRIGHT](COPYRIGHT) file for detailed copyright information and the [app/LICENSE](app/LICENSE) file for the full license text.

As required by the AGPL-3.0 license:
- All modifications are clearly documented
- Source code is publicly available at: https://github.com/celya44/celyavox
- Users interacting with the software over a network have access to the source code

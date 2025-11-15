# SipApp

This skeleton wraps the SipApp-Phone web app into an Electron desktop application
for Windows, macOS and Linux. It provides:
- a secure `preload.js` bridge for IPC
- `main.js` Electron bootstrap (custom pro window, splash placeholder)
- a lightweight SQLite service in the main process exposed via IPC
- packaging config using `electron-builder` to produce installers

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

Si vous utilisez l'app image il faut faire un wraper pour ajouter --no-sandbox, ou lancer la commande ./SipApp-dev-1.0.0.AppImage --no-sandbox





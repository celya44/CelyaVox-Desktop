const { app, BrowserWindow, ipcMain, dialog, session, Tray, Menu, nativeImage, Notification } = require('electron'); // 🔧 AJOUT Notification
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;
let lastAutoFocusTs = 0;

// ----------------------
// Command line switches
// ----------------------
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-setuid-sandbox');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('use-gl', 'swiftshader');
// Autoriser l'autoplay audio pour le ringtone même sans interaction utilisateur
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ----------------------
// Create main window
// ----------------------
function createWindow() {
  // Détermine une icône de fenêtre appropriée (Linux utilise celle-ci)
  const windowIconCandidates = [
    path.join(__dirname, 'assets', 'icons', '256x256.png'),
    path.join(__dirname, 'app', 'Phone', 'avatars', 'logo.png')
  ];
  const windowIconPath = windowIconCandidates.find(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'SipApp',
  // Icône de la fenêtre (principalement Linux)
  icon: windowIconPath,
    autoHideMenuBar: true, // 🔧 cache le menu
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      media: true
    }
  });

  const serverUrl = 'https://freepbx17-dev.celya.fr/sipapp';
  mainWindow.loadURL(serverUrl, {
    extraHeaders: 'pragma: no-cache\n' + 'cache-control: no-cache'
  }).catch(err => {
    dialog.showErrorBox('Erreur', `Impossible de charger l'application depuis le serveur: ${err.message}`);
  });

  // Show when ready
  mainWindow.once('ready-to-show', () => mainWindow.show());

  //mainWindow.webContents.openDevTools();

  // Media permissions
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') callback(true);
    else callback(false);
  });

  // Log all network requests
  mainWindow.webContents.session.webRequest.onCompleted((details) => {
    console.log('[Network]', details.method, details.url, details.statusCode);
  });

  // 🔧 Empêche la fermeture complète + affiche une notification
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      if (process.platform === 'darwin') app.dock.hide(); // 🍎 macOS : cache le dock

      // 🔔 Notification système
      showBackgroundNotification();
    }
  });

  return mainWindow;
}

// ----------------------
// Mise au premier plan (focus + attention visuelle)
// ----------------------
function bringAppToFront() {
  if (!mainWindow) return;
  // Affiche et tente de capturer le focus
  try { mainWindow.restore(); } catch {}
  try { mainWindow.setSkipTaskbar(false); } catch {}
  mainWindow.show();
  if (process.platform === 'darwin') app.dock.show();
  try { mainWindow.focus(); } catch {}

  // Maintien temporaire au premier plan pour contourner certaines politiques de focus
  try { mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
  try { mainWindow.setAlwaysOnTop(true, 'screen-saver'); } catch {}
  setTimeout(() => {
    try { mainWindow.setAlwaysOnTop(false); } catch {}
    try { mainWindow.setVisibleOnAllWorkspaces(false); } catch {}
  }, 5000);

  // Demander l'attention de l'utilisateur selon l'OS
  if (process.platform === 'darwin') {
    try { app.dock.bounce('informational'); } catch {}
  } else {
    try { mainWindow.flashFrame(true); } catch {}
  }
}

// Détection côté main via la console de la page web (pas besoin de modifier le code distant)
function wireIncomingCallDetectors(win) {
  if (!win || !win.webContents) return;
  try {
    win.webContents.on('console-message', (event, level, message) => {
      try {
        const msg = String(message || '').toLowerCase();
        // Indices typiques du code web lors d'un appel entrant
        const hit = (
          msg.includes('new incoming call') ||
          msg.includes('incoming call') ||
          msg.includes('appel entrant') ||
          msg.includes('ringtone') || // sonnerie jouée
          (msg.includes('call progress:') && msg.includes('180')) // Outgoing 180 Ringing (optionnel)
        );
        if (hit) {
          const now = Date.now();
          if (now - lastAutoFocusTs > 8000) { // anti-spam ~8s
            lastAutoFocusTs = now;
            bringAppToFront();
          }
        }
      } catch {}
    });
  } catch {}
}

// ----------------------
// Fonction : Notification “reste en arrière-plan”
// ----------------------
function showBackgroundNotification() {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'SipApp reste active',
      body: 'L’application continue de s’exécuter dans la barre d’état système.',
      silent: true, // pas de son
      icon: path.join(__dirname, 'app', 'Phone', 'avatars', 'logo.png')
    });
    notification.show();
  }
}

// ----------------------
// IPC DB API
// ----------------------
ipcMain.handle('db-get', (event, key) => null);
ipcMain.handle('db-set', (event, key, value) => true);

// ----------------------
// App ready
// ----------------------
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') callback(true);
    else callback(false);
  });

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.endsWith('service-worker.js')) {
      return callback({ cancel: true });
    }
    callback({});
  });

  // IPC: canal explicite pour signaler un appel entrant depuis le renderer
  ipcMain.handle('incoming-call', () => {
    bringAppToFront();
    return true;
  });

  createWindow();
  wireIncomingCallDetectors(mainWindow);

  // Heuristique: certains softphones changent le titre lors d'un appel entrant
  const KEYWORDS = ['incoming', 'ring', 'appel', 'appel entrant', 'call'];
  mainWindow.on('page-title-updated', (e, title) => {
    try {
      const low = String(title || '').toLowerCase();
      if (KEYWORDS.some(k => low.includes(k))) {
        const now = Date.now();
        if (now - lastAutoFocusTs > 10000) { // anti-spam 10s
          lastAutoFocusTs = now;
          bringAppToFront();
        }
      }
    } catch {}
  });

  // 🔧 Création du Tray (icône barre d’état) avec choix par OS et redimensionnement
  const iconCandidates = [];
  const iconsDir = path.join(__dirname, 'assets', 'icons');
  if (process.platform === 'win32') {
    // Préfère un PNG 16x16 pour le Tray (meilleure netteté), sinon fallback
    iconCandidates.push(path.join(iconsDir, '16x16.png'));
  } else if (process.platform === 'darwin') {
    // Préfère un PNG 16x16 (on redimensionnera à 18 pour le template)
    iconCandidates.push(path.join(iconsDir, '16x16.png'));
  } else {
    // Linux: 24x24 recommandé
    iconCandidates.push(path.join(iconsDir, '24x24.png'));
  }
  // Fallback générique
  iconCandidates.push(path.join(__dirname, 'app', 'Phone', 'avatars', 'logo.png'));

  const resolvedIconPath = iconCandidates.find(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  let trayImage = nativeImage.createFromPath(resolvedIconPath);

  // Si l'image est trop grande, certaines barres système sous Linux l'affichent tronquée.
  // On redimensionne explicitement selon la plateforme.
  if (!trayImage.isEmpty()) {
    if (process.platform === 'darwin') {
      // macOS : petite taille + template monochrome
      trayImage = trayImage.resize({ width: 18, height: 18, quality: 'best' });
      trayImage.setTemplateImage(true);
    } else if (process.platform === 'win32') {
      // Windows : 16px est généralement adapté à la zone de notification
      trayImage = trayImage.resize({ width: 16, height: 16, quality: 'best' });
    } else {
      // Linux : 22-24px est la convention la plus commune (Gnome/KDE)
      trayImage = trayImage.resize({ width: 24, height: 24, quality: 'best' });
    }
  }

  tray = new Tray(trayImage);

  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Afficher la fenêtre',
      click: () => {
        mainWindow.show();
        if (process.platform === 'darwin') app.dock.show(); // 🍎 restaure le dock
      }
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        app.isQuiting = true;
        mainWindow.destroy();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('SipApp');
  tray.setContextMenu(trayMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    if (process.platform === 'darwin') app.dock.show();
  });

  // 🍎 macOS : comportement du Dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

// ----------------------
// Gestion fermeture selon OS
// ----------------------
app.on('window-all-closed', (e) => {
  // 🪟 Sous Windows/Linux, on ne quitte pas pour garder le tray actif
  if (process.platform !== 'darwin') e.preventDefault();
});

app.on('before-quit', () => (app.isQuiting = true));


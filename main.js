/**
 * CelyaVox - Electron Desktop Application
 * 
 * Copyright (C) 2025 CELYA <debian@celya.fr>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const { app, BrowserWindow, ipcMain, dialog, session, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const config = require('./config');

console.log(`🚀 Démarrage de l'application en mode: ${config.environment}`);
console.log(`📡 URL du serveur: ${config.serverUrl}`);
console.log(`📦 Nom de l'application: ${config.appName}`);

// Séparer les données utilisateur entre dev et prod
if (config.isDev) {
  const userDataPath = path.join(app.getPath('userData'), '..', 'celyavox-dev');
  app.setPath('userData', userDataPath);
  console.log(`💾 Données utilisateur (DEV): ${userDataPath}`);
} else {
  console.log(`💾 Données utilisateur (PROD): ${app.getPath('userData')}`);
}

let mainWindow;
let tray;
let lastAutoFocusTs = 0;
let notificationWindow = null;
let lastAlreadyRunningDialogTs = 0;
let pendingTrayLeftMenuRequest = null;
let pendingTrayLeftMenuRequestId = 0;
let trayLeftMenuCache = { hasActiveCall: false, favorites: [] };
let pendingTelNumber = null;

const TEL_PROTOCOL = 'tel';

function normalizeTelUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!/^tel:/i.test(trimmed)) return '';
  let value = trimmed.replace(/^tel:/i, '');
  if (value.startsWith('//')) value = value.slice(2);
  value = value.split(/[;?]/)[0];
  return decodeURIComponent(value).trim();
}

function extractTelUrlFromArgs(args) {
  if (!Array.isArray(args)) return '';
  const found = args.find(arg => typeof arg === 'string' && /^tel:/i.test(arg.trim()));
  return found || '';
}

function sendTelToRenderer(number) {
  if (!number) return;
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingTelNumber = number;
    return;
  }
  if (mainWindow.webContents && mainWindow.webContents.isLoading()) {
    pendingTelNumber = number;
    return;
  }
  try { mainWindow.restore(); } catch {}
  mainWindow.show();
  try { mainWindow.focus(); } catch {}
  mainWindow.webContents.send('tray-dial', number);
}

function handleTelUrl(url) {
  const number = normalizeTelUrl(url);
  if (!number) return false;
  sendTelToRenderer(number);
  return true;
}

function registerTelProtocolClient() {
  const options = getProtocolClientOptions();
  if (options) {
    const ok = app.setAsDefaultProtocolClient(TEL_PROTOCOL, options.path, options.args);
    console.log(`📞 setAsDefaultProtocolClient(${TEL_PROTOCOL}) dev: ${ok}`);
    return ok;
  }
  const ok = app.setAsDefaultProtocolClient(TEL_PROTOCOL);
  console.log(`📞 setAsDefaultProtocolClient(${TEL_PROTOCOL}): ${ok}`);
  return ok;
}

function getProtocolClientOptions() {
  if (process.defaultApp && process.argv.length >= 2) {
    const appPath = path.resolve(process.argv[1]);
    return { path: process.execPath, args: [appPath] };
  }
  return null;
}

function isDefaultTelProtocolClient() {
  const options = getProtocolClientOptions();
  if (options) {
    return app.isDefaultProtocolClient(TEL_PROTOCOL, options.path, options.args);
  }
  return app.isDefaultProtocolClient(TEL_PROTOCOL);
}

async function promptToRegisterTelProtocolClient() {
  if (isDefaultTelProtocolClient()) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Gestionnaire tel: par defaut',
    message: "CelyaVox n'est pas le gestionnaire par defaut pour les liens tel:.",
    detail: 'Souhaitez-vous definir CelyaVox comme gestionnaire par defaut ? ',
    buttons: ['Oui', 'Non'],
    defaultId: 0,
    cancelId: 1
  });
  if (result.response === 0) {
    registerTelProtocolClient();
  }
}

// ----------------------
// Empêcher plusieurs instances
// ----------------------
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('⚠️ Une instance de l\'application est déjà en cours d\'exécution');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('⚠️ Tentative de lancement d\'une deuxième instance détectée');
    const telUrl = extractTelUrlFromArgs(commandLine);
    if (telUrl) {
      handleTelUrl(telUrl);
    }
    const now = Date.now();
    if (!telUrl && mainWindow && now - lastAlreadyRunningDialogTs > 3000) {
      lastAlreadyRunningDialogTs = now;
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Application déjà ouverte',
        message: 'L\'application est déjà en cours d\'exécution.',
        detail: 'La fenêtre existante va être mise au premier plan.'
      });
    }
    // Afficher et mettre au premier plan la fenêtre existante
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (process.platform === 'darwin') app.dock.show();
    }
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleTelUrl(url);
});

const initialTelUrl = extractTelUrlFromArgs(process.argv);
if (initialTelUrl) {
  pendingTelNumber = normalizeTelUrl(initialTelUrl);
}

// ----------------------
// Command line switches
// ----------------------
// Détecter si on est en session RDP
const isRDP = process.env.SESSIONNAME && process.env.SESSIONNAME.includes('RDP');
console.log(`🖥️ Session RDP détectée: ${isRDP}`);

// GPU: utiliser le rendu logiciel compatible RDP
if (isRDP) {
  // En RDP, forcer le rendu logiciel
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('enable-begin-frame-scheduling');
} else {
  // En local, désactiver le GPU si nécessaire
  app.commandLine.appendSwitch('disable-gpu');
}

app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-setuid-sandbox');

// Autoriser l'autoplay audio pour le ringtone même sans interaction utilisateur
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Forcer l'accès aux devices media (crucial pour RDP)
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('enable-media-stream');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
// Forcer l'énumération des devices audio même en RDP
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');

// ----------------------
// Create main window
// ----------------------
async function createWindow() {
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
    title: config.appName,
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
      enableWebSQL: false,
      // Améliorer les performances en RDP
      offscreen: false,
      backgroundThrottling: false
    }
  });

  const serverUrl = config.serverUrl;
  let connectivityDialogShown = false;

  const showConnectivityError = (details) => {
    if (connectivityDialogShown) return;
    connectivityDialogShown = true;
    console.error('❌ Échec de chargement URL:', details);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Connexion Internet requise',
      message: 'Impossible de charger l’application.',
      detail: 'Veuillez contrôler la connectivité internet puis relancer l’application.'
    });
  };
  
  // Clear cache before loading (but keep localStorage for settings)
  await mainWindow.webContents.session.clearCache();
  console.log('✅ Cache vidé (localStorage préservé)');
  
  // Charger l'URL puis forcer un reload sans cache
  mainWindow.loadURL(serverUrl).then(() => {
    console.log('🔄 Rechargement sans cache...');
    mainWindow.webContents.reloadIgnoringCache();
  }).catch(err => {
    showConnectivityError(err.message || err);
  });

  // Détecter les erreurs de chargement (ex: pas de connexion)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    // Ignorer les navigations interrompues volontairement
    if (errorCode === -3) return; // ERR_ABORTED
    showConnectivityError(`${errorDescription} (code ${errorCode}) - ${validatedURL}`);
  });

  // Show when ready
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // mainWindow.webContents.openDevTools(); // Désactivé - décommenter pour debug
  
  // Menu contextuel (clic droit) avec fonctions copier/coller
  mainWindow.webContents.on('context-menu', (event, params) => {
    const contextMenu = Menu.buildFromTemplate([
      { role: 'cut', label: 'Couper', enabled: params.editFlags.canCut },
      { role: 'copy', label: 'Copier', enabled: params.editFlags.canCopy },
      { role: 'paste', label: 'Coller', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', label: 'Tout sélectionner' },
      ...(params.misspelledWord ? [
        { type: 'separator' },
        ...params.dictionarySuggestions.slice(0, 5).map(suggestion => ({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion)
        }))
      ] : []),
      ...(process.env.NODE_ENV === 'development' ? [
        { type: 'separator' },
        { role: 'reload', label: 'Recharger' },
        { role: 'toggleDevTools', label: 'Outils de développement' }
      ] : [])
    ]);
    contextMenu.popup();
  });
  
  // Injecter CSS pour forcer la sélection de texte - avant le chargement
  mainWindow.webContents.on('dom-ready', () => {
    const cssToInject = `
      /* Force l'activation de la sélection de texte */
      body, body *, .NoSelect, .chatHistory, .tags li, div, span, p, td, th, li {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
      }
      input, textarea, [contenteditable="true"], .messageText {
        -webkit-user-select: text !important;
        user-select: text !important;
        cursor: text !important;
      }
      button, a, [role="button"], .roundButtons, .toolBarButtons, [onclick], input[type="button"], input[type="submit"] {
        -webkit-user-select: none !important;
        user-select: none !important;
        cursor: pointer !important;
      }
    `;
    
    mainWindow.webContents.insertCSS(cssToInject).then(() => {
      console.log('✅ CSS de sélection de texte injecté');
    }).catch(err => {
      console.error('❌ Erreur injection CSS:', err);
    });
  });
  
  // Injecter les informations de version après le chargement de la page
  mainWindow.webContents.on('did-finish-load', () => {
    const packageInfo = require('./package.json');
    const versionInfo = {
      app: packageInfo.version,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    };
    
    const script = `
      if (!window.env) {
        window.env = { isElectron: true };
      }
      window.env.versions = ${JSON.stringify(versionInfo)};
      console.log('✅ Versions injectées:', window.env.versions);
    `;
    
    mainWindow.webContents.executeJavaScript(script).catch(err => {
      console.error('❌ Erreur injection versions:', err);
    });

    if (pendingTelNumber) {
      const number = pendingTelNumber;
      pendingTelNumber = null;
      sendTelToRenderer(number);
    }
  });

  // Media permissions - accorder toutes les permissions media
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('🔐 Permission demandée:', permission);
    const allowedPermissions = ['media', 'mediaDevices', 'video', 'audio', 'audioCapture', 'videoCapture', 'microphone', 'camera'];
    if (allowedPermissions.includes(permission)) {
      console.log('✅ Permission accordée:', permission);
      callback(true);
    } else {
      console.log('❌ Permission refusée:', permission);
      callback(false);
    }
  });
  
  // Log des devices media disponibles après chargement
  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const devices = await mainWindow.webContents.executeJavaScript(`
        navigator.mediaDevices.enumerateDevices().then(devices => {
          console.log('🎤🔊 Devices détectés:', devices.length);
          devices.forEach(device => {
            console.log('  -', device.kind, ':', device.label || 'Sans nom');
          });
          return devices.length;
        });
      `);
      console.log(`📱 Total devices media: ${devices}`);
    } catch (err) {
      console.error('❌ Erreur énumération devices:', err);
    }
  });
  
  // Forcer les permissions media
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('🔍 Permission check:', permission, 'from', requestingOrigin);
    if (permission === 'media' || permission.includes('audio') || permission.includes('video')) {
      return true;
    }
    return true; // Autoriser tout pour le debug
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

      // 🔔 Notification système (seulement si le service est disponible)
      try {
        showBackgroundNotification();
      } catch (err) {
        console.log('⚠️ Notification système non disponible:', err.message);
      }
    }
  });

  return mainWindow;
}

// ----------------------
// Mise au premier plan (focus + attention visuelle) - DÉSACTIVÉ
// ----------------------
function bringAppToFront() {
  if (!mainWindow) return;
  // Ne prend plus le focus automatiquement
  // Juste une notification discrète dans la barre des tâches
  
  // Demander l'attention de l'utilisateur selon l'OS (sans prendre le focus)
  if (process.platform === 'darwin') {
    try { app.dock.bounce('informational'); } catch {}
  } else {
    try { mainWindow.flashFrame(true); } catch {}
  }
}

// Notification pour appel entrant avec fenêtre personnalisée
// ----------------------
function showIncomingCallNotification(callerInfo = 'Appel entrant') {
  console.log('🔔 Fenêtre de notification créée pour:', callerInfo);
  
  // Si une fenêtre de notification existe déjà, la fermer d'abord
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    console.log('⚠️ Fermeture de la notification existante avant d\'en créer une nouvelle');
    notificationWindow.close();
    notificationWindow = null;
  }
  
  // Créer une petite fenêtre de notification
  notificationWindow = new BrowserWindow({
    width: 350,
    height: 200,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  // Positionner la fenêtre en haut à droite de l'écran
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  notificationWindow.setPosition(width - 370, 20);
  
  // Charger le HTML de notification avec les infos en paramètre
  const notificationHtmlPath = path.join(__dirname, 'notification-call.html');
  const encodedCallerInfo = encodeURIComponent(callerInfo);
  const fileUrl = `file://${notificationHtmlPath}?caller=${encodedCallerInfo}`;
  console.log('📄 Chargement de la notification depuis:', fileUrl);
  
  notificationWindow.loadURL(fileUrl).catch(err => {
    console.error('❌ Erreur lors du chargement de notification-call.html:', err);
  });

  notificationWindow.once('ready-to-show', () => {
    try {
      // Afficher sans voler le focus
      notificationWindow.showInactive();
    } catch (e) {
      // Fallback si showInactive n'est pas disponible
      notificationWindow.show();
    }
  });
  
  // Gérer les erreurs de chargement
  notificationWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Échec du chargement de la notification:', errorCode, errorDescription);
  });
  
  // Auto-fermeture après 30 secondes
  const autoCloseTimeout = setTimeout(() => {
    if (notificationWindow && !notificationWindow.isDestroyed()) {
      notificationWindow.close();
    }
  }, 30000);
  
  notificationWindow.on('closed', () => {
    clearTimeout(autoCloseTimeout);
    notificationWindow = null;
  });
  
  console.log('🔔 Fenêtre de notification créée pour:', callerInfo);
}

// Détection désactivée - on utilise maintenant le système IPC dédié
// function wireIncomingCallDetectors(win) {
//   ...
// }

// ----------------------
// Fonction : Notification “reste en arrière-plan”
// ----------------------
function showBackgroundNotification() {
  console.log('🔔 showBackgroundNotification appelée');
  if (Notification.isSupported()) {
    console.log('✅ Notification supportée, création...');
    const notification = new Notification({
      title: `${config.appName} reste active`,
      body: 'L\'application continue de s\'exécuter dans la barre d\'état système.',
      silent: true, // pas de son
      icon: path.join(__dirname, 'app', 'Phone', 'avatars', 'logo.png'),
      timeoutType: 'default'
    });
    notification.show();
    console.log('✅ Notification affichée');
    
    // Fermer la notification après 3 secondes
    setTimeout(() => {
      notification.close();
      console.log('✅ Notification fermée après 3s');
    }, 3000);
  } else {
    console.log('❌ Notification non supportée');
  }
}

// ----------------------
// IPC handlers pour la notification d'appel
// ----------------------
console.log('🔧 Enregistrement des gestionnaires IPC pour les notifications d\'appel');

ipcMain.on('answer-call', (event) => {
  console.log('📞 [IPC] Événement answer-call reçu');
  console.log('📞 Répondre à l\'appel demandé depuis la notification');
  console.log('📞 notificationWindow existe?', !!notificationWindow);
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    console.log('📞 Fermeture de la fenêtre de notification...');
    notificationWindow.hide(); // Cacher immédiatement
    notificationWindow.close();
    notificationWindow = null;
    console.log('📞 Fenêtre de notification fermée');
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('answer-call');
    console.log('📞 Événement answer-call envoyé à la fenêtre principale');
  }
});

ipcMain.on('reject-call', (event) => {
  console.log('❌ [IPC] Événement reject-call reçu');
  console.log('❌ Rejeter l\'appel demandé depuis la notification');
  console.log('❌ notificationWindow existe?', !!notificationWindow);
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    console.log('❌ Fermeture de la fenêtre de notification...');
    notificationWindow.hide(); // Cacher immédiatement
    notificationWindow.close();
    notificationWindow = null;
    console.log('❌ Fenêtre de notification fermée');
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('reject-call');
    console.log('❌ Événement reject-call envoyé à la fenêtre principale');
  }
});

// Fermer la notification quand l'appel est répondu depuis l'app principale
ipcMain.on('call-answered-from-app', () => {
  console.log('✅ [IPC] Appel répondu depuis l\'application principale');
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    console.log('✅ Fermeture de la fenêtre de notification...');
    notificationWindow.close();
    notificationWindow = null;
  }
});

// Fermer la notification quand l'appel est rejeté depuis l'app principale
ipcMain.on('call-rejected-from-app', () => {
  console.log('❌ [IPC] Appel rejeté depuis l\'application principale');
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    console.log('❌ Fermeture de la fenêtre de notification...');
    notificationWindow.close();
    notificationWindow = null;
  }
});

// Fermer la notification quand l'appel est annulé par le correspondant
ipcMain.on('call-cancelled', () => {
  console.log('🚫 [IPC] Appel annulé par le correspondant');
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    console.log('🚫 Fermeture de la fenêtre de notification...');
    notificationWindow.close();
    notificationWindow = null;
  }
});

// ----------------------
// IPC: Tray left-click menu data
// ----------------------
ipcMain.on('tray-left-menu-response', (event, payload) => {
  if (!pendingTrayLeftMenuRequest) return;
  const requestId = payload && payload.requestId;
  if (requestId !== pendingTrayLeftMenuRequest.id) return;
  clearTimeout(pendingTrayLeftMenuRequest.timeout);
  const resolve = pendingTrayLeftMenuRequest.resolve;
  pendingTrayLeftMenuRequest = null;
  const data = (payload && payload.data) || {};
  trayLeftMenuCache = {
    hasActiveCall: !!data.hasActiveCall,
    favorites: Array.isArray(data.favorites) ? data.favorites : []
  };
  resolve(data);
});

ipcMain.on('tray-left-menu-cache', (event, payload) => {
  const data = (payload && payload.data) || {};
  trayLeftMenuCache = {
    hasActiveCall: !!data.hasActiveCall,
    favorites: Array.isArray(data.favorites) ? data.favorites : []
  };
});

// ----------------------
// IPC DB API
// ----------------------
ipcMain.handle('db-get', (event, key) => null);
ipcMain.handle('db-set', (event, key, value) => true);

// IPC: Get app info
const packageJson = require('./package.json');
ipcMain.handle('get-app-info', () => ({
  version: packageJson.version,
  name: packageJson.name,
  isRDP: process.env.SESSIONNAME && process.env.SESSIONNAME.includes('RDP')
}));

// IPC: Get app info synchronously (for preload)
ipcMain.on('get-app-info-sync', (event) => {
  event.returnValue = {
    version: packageJson.version,
    name: packageJson.name,
    isRDP: process.env.SESSIONNAME && process.env.SESSIONNAME.includes('RDP')
  };
});

// ----------------------
// App ready
// ----------------------
app.whenReady().then(async () => {
  registerTelProtocolClient();
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('🔐 Permission globale demandée:', permission);
    const allowedPermissions = ['media', 'mediaDevices', 'video', 'audio', 'audioCapture', 'videoCapture'];
    if (allowedPermissions.includes(permission)) {
      console.log('✅ Permission globale accordée:', permission);
      callback(true);
    } else {
      console.log('⚠️ Permission inconnue accordée pour debug:', permission);
      callback(true); // Autoriser tout pour le debug
    }
  });
  
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('🔍 Permission check globale:', permission, 'from', requestingOrigin);
    return true; // Autoriser tout pour le debug
  });

  // Intercepter les requêtes pour ajouter cache buster aux ressources JS/CSS
  const cacheBuster = Date.now();
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.endsWith('service-worker.js')) {
      return callback({ cancel: true });
    }
    
    // Ajouter cache buster aux fichiers JS et CSS du serveur (dev ou prod)
    const serverDomain = config.serverUrl.replace(/^https?:\/\//, '');
    if (details.url.includes(serverDomain) && 
        (details.url.endsWith('.js') || details.url.endsWith('.css'))) {
      const separator = details.url.includes('?') ? '&' : '?';
      const newUrl = `${details.url}${separator}_cb=${cacheBuster}`;
      console.log(`🔄 Cache buster: ${details.url} -> ${newUrl}`);
      return callback({ redirectURL: newUrl });
    }
    
    callback({});
  });

  // IPC: canal explicite pour signaler un appel entrant depuis le renderer
  console.log('🔧 Enregistrement du handler IPC incoming-call');
  ipcMain.handle('incoming-call', (event, callerInfo) => {
    console.log('📞 [IPC incoming-call] Reçu avec callerInfo:', callerInfo);
    bringAppToFront();
    showIncomingCallNotification(callerInfo || 'Nouvel appel entrant');
    return true;
  });

  // IPC: Décrocher depuis la fenêtre de notification
  ipcMain.on('notification-answer', () => {
    console.log('🔔 Bouton Décrocher cliqué dans la notification');
    // Fermer la fenêtre de notification
    if (notificationWindow && !notificationWindow.isDestroyed()) {
      notificationWindow.close();
    }
    // Afficher la fenêtre principale
    try { mainWindow.restore(); } catch {}
    try { mainWindow.setSkipTaskbar(false); } catch {}
    mainWindow.show();
    try { mainWindow.focus(); } catch {}
    // Envoyer l'événement de réponse à l'appel
    mainWindow.webContents.send('answer-call');
  });

  // IPC: Raccrocher depuis la fenêtre de notification
  ipcMain.on('notification-reject', () => {
    console.log('🔔 Bouton Raccrocher cliqué dans la notification');
    // Fermer la fenêtre de notification
    if (notificationWindow && !notificationWindow.isDestroyed()) {
      notificationWindow.close();
    }
    // Envoyer l'événement de rejet sans afficher la fenêtre
    mainWindow.webContents.send('reject-call');
  });

  await createWindow();
  promptToRegisterTelProtocolClient().catch(err => {
    console.error('❌ Erreur prompt handler tel:', err);
  });
  // wireIncomingCallDetectors(mainWindow); // Désactivé - utilise IPC maintenant

  // Heuristique désactivée: on utilise maintenant le système IPC dédié
  // pour les notifications d'appel entrant (incoming-call event)
  // mainWindow.on('page-title-updated', (e, title) => {
  //   ...
  // });

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

  const rightClickMenu = Menu.buildFromTemplate([
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

  function buildLeftClickMenu(data) {
    const items = [];
    const hasActiveCall = !!(data && data.hasActiveCall);
    const favorites = Array.isArray(data && data.favorites) ? data.favorites : [];

    if (hasActiveCall) {
      items.push({
        label: 'Raccrocher',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('tray-hangup');
          }
        }
      });
      items.push({ type: 'separator' });
    }

    if (favorites.length > 0) {
      favorites.forEach((fav) => {
        const name = (fav && fav.name) ? String(fav.name).trim() : '';
        const number = (fav && fav.number) ? String(fav.number).trim() : '';
        if (!number) return;
        const label = name ? `${name} (${number})` : number;
        items.push({
          label,
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('tray-dial', number);
            }
          }
        });
      });
    } else {
      items.push({ label: 'Aucun favori', enabled: false });
    }

    return Menu.buildFromTemplate(items);
  }

  function requestTrayLeftMenuData() {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return Promise.resolve({ hasActiveCall: false, favorites: [] });
    }

    if (pendingTrayLeftMenuRequest) {
      clearTimeout(pendingTrayLeftMenuRequest.timeout);
      pendingTrayLeftMenuRequest.resolve({ hasActiveCall: false, favorites: [] });
      pendingTrayLeftMenuRequest = null;
    }

    const requestId = ++pendingTrayLeftMenuRequestId;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (pendingTrayLeftMenuRequest && pendingTrayLeftMenuRequest.id === requestId) {
          pendingTrayLeftMenuRequest = null;
          resolve({ hasActiveCall: false, favorites: [] });
        }
      }, 1200);

      pendingTrayLeftMenuRequest = { id: requestId, resolve, timeout };
      mainWindow.webContents.send('tray-left-menu-request', { requestId });
    });
  }

  tray.setToolTip(config.appName);
  // Ne pas utiliser setContextMenu ici: sous Linux, cela force le menu au clic gauche.
  tray.on('mouse-up', async (event) => {
    if (event && event.button === 2) {
      tray.popUpContextMenu(rightClickMenu);
      return;
    }

    const cachedMenu = buildLeftClickMenu(trayLeftMenuCache);
    tray.popUpContextMenu(cachedMenu);

    // Refresh cache in the background for next click
    requestTrayLeftMenuData().catch(() => {});
  });

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


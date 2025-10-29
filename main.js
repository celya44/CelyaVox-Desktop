const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

// ----------------------
// Command line switches
// ----------------------
app.commandLine.appendSwitch('disable-gpu');                 // disable hardware GPU
app.commandLine.appendSwitch('disable-software-rasterizer'); // fallback GPU
app.commandLine.appendSwitch('ignore-certificate-errors', 'true'); // bypass self-signed certs
app.commandLine.appendSwitch('disable-web-security');        // bypass CORS
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');

// ----------------------
// Create main window
// ----------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'SipApp',
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
  win.loadURL(serverUrl, {
    extraHeaders: 'pragma: no-cache\n' + 'cache-control: no-cache'
  }).catch(err => {
    dialog.showErrorBox('Erreur', `Impossible de charger l'application depuis le serveur: ${err.message}`);
  });

  // Show when ready
  win.once('ready-to-show', () => win.show());

  // Open DevTools by default
  win.webContents.openDevTools();

  // Media permissions
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') callback(true);
    else callback(false);
  });

  // Log all network requests (fetch, XHR)
  win.webContents.session.webRequest.onCompleted((details) => {
    console.log('[Network]', details.method, details.url, details.statusCode);
  });

  return win;
}

// ----------------------
// IPC DB API
// ----------------------
ipcMain.handle('db-get', (event, key) => {
  return null;
});

ipcMain.handle('db-set', (event, key, value) => {
  return true;
});

// ----------------------
// App ready
// ----------------------
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true); // autoriser l'accès caméra/micro
    } else {
      callback(false);
    }
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.endsWith('service-worker.js')) {
      return callback({ cancel: true });
    }
    callback({});
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});


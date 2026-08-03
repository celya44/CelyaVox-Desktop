/**
 * Example: Minimal Electron app with automatic SAML authentication on startup
 * No UI required - just authenticate and proceed
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { SamlClient, loadSAMLConfig, logger } from '../src';

let mainWindow: BrowserWindow | null = null;
let samlClient: SamlClient | null = null;
let authenticatedUser: any = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = require('electron-is-dev');
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

async function initSAML() {
  try {
    logger.info('Starting SAML authentication...');

    // Load SAML configuration
    const samlConfig = loadSAMLConfig();
    logger.info('SAML config loaded');

    // Create SAML client
    samlClient = new SamlClient(samlConfig, {
      port: 3001,
      autoLaunch: true,
      closeWindowOnSuccess: true,
    });

    if (mainWindow) {
      samlClient.setMainWindow(mainWindow);
    }

    // Initialize with callbacks
    await samlClient.initialize({
      onSuccess: (result) => {
        logger.info('✅ SAML authentication successful!');
        logger.info('User info:', result.user);

        authenticatedUser = result.user;

        // Send user info to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('saml:authenticated', result.user);
        }

        // You can now proceed with your application logic
        // - Make API calls with the SAML assertion
        // - Load protected resources
        // - Initialize the app with user data
      },
      onError: (error) => {
        logger.error('❌ SAML authentication failed:', error.message);

        // Send error to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('saml:error', { error: error.message });
        }

        // Optionally, retry or exit
        // app.quit();
      },
    });

    // Start SAML server
    await samlClient.start();
    logger.info(`SAML server started on port 3001`);

    // Automatically open the login URL in the browser
    const { shell } = require('electron');
    const loginURL = samlClient.getLoginURL();
    logger.info(`Opening login URL: ${loginURL}`);
    
    await shell.openExternal(loginURL);

    logger.info('SAML initialization complete. Waiting for user authentication...');
  } catch (error: any) {
    logger.error('Failed to initialize SAML:', error.message);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('saml:error', { error: error.message });
    }

    // Optionally exit if authentication is critical
    // app.quit();
  }
}

app.on('ready', async () => {
  createWindow();

  if (mainWindow) {
    // Initialize SAML authentication
    await initSAML();
  }
});

app.on('window-all-closed', async () => {
  // Cleanup SAML server
  if (samlClient) {
    await samlClient.stop();
    logger.info('SAML server stopped');
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handler to get current user from renderer
ipcMain.handle('saml:get-user', () => {
  return authenticatedUser;
});

// IPC handler to logout
ipcMain.handle('saml:logout', async () => {
  authenticatedUser = null;
  logger.info('User logged out');
  return { success: true };
});

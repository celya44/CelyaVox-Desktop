/**
 * CelyaVox - Electron Desktop Application - Preload Script
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

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // DB helpers
  dbGet: (key) => ipcRenderer.invoke('db-get', key),
  dbSet: (key, value) => ipcRenderer.invoke('db-set', key, value),
  // Dialog
  openDialog: (opts) => ipcRenderer.invoke('show-open-dialog', opts),
  // Generic IPC
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, cb) => {
    console.log('[Preload] Registering listener for channel:', channel);
    const listener = (evt, ...args) => {
      console.log('[Preload] Event received on channel:', channel, 'with args:', args);
      cb(...args);
    };
    ipcRenderer.on(channel, listener);
    return listener;
  },
  // Convenience: signal incoming call to bring app to front
  incomingCall: (callerInfo) => ipcRenderer.invoke('incoming-call', callerInfo),
  bringToFront: () => ipcRenderer.invoke('incoming-call'),
  // Get app info
  getAppInfo: () => ipcRenderer.invoke('get-app-info')
})

// Expose CelyaVox config for loading page
const celyavoxConfig = {
  serverUrl: 'http://localhost:3000',
  timeout: 30000
};

// Fonction pour update la config depuis main
function updateCelyavoxConfig(newConfig) {
  Object.assign(celyavoxConfig, newConfig);
  console.log('[Preload] Config mise à jour:', celyavoxConfig);
}

contextBridge.exposeInMainWorld('celyavoxConfig', celyavoxConfig);
contextBridge.exposeInMainWorld('updateCelyavoxConfig', updateCelyavoxConfig);
ipcRenderer.on('set-config', (event, config) => {
  updateCelyavoxConfig(config);
});

// Detect RDP directly from process.env in preload
const isRDP = !!(process.env.SESSIONNAME && process.env.SESSIONNAME.includes('RDP'));
console.log('[Preload] SESSIONNAME:', process.env.SESSIONNAME);
console.log('[Preload] Is RDP:', isRDP);

// Get app info synchronously from main process before exposing env
let appVersion = '1.0.4'; // Default version
try {
  const syncResult = ipcRenderer.sendSync('get-app-info-sync');
  console.log('[Preload] Sync result:', syncResult);
  if (syncResult && syncResult.version) {
    appVersion = syncResult.version;
    console.log('[Preload] Version from IPC:', appVersion);
  } else {
    console.warn('[Preload] IPC sync failed, using default version');
  }
} catch (err) {
  console.error('[Preload] Erreur lors de la récupération des infos app:', err);
}

// Expose env info with app version
contextBridge.exposeInMainWorld('env', {
  isElectron: true,
  isRDP: isRDP,
  versions: {
    app: appVersion,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
});

console.log('[Preload] window.env exposé:', { app: appVersion, isRDP });

// Sauvegarder les valeurs avant que phone.js les écrase
const _electronRDP = isRDP;
const _electronVersion = appVersion;

// Helper pour détecter et logger les problèmes RDP
window.addEventListener('DOMContentLoaded', () => {
  // Utiliser les valeurs sauvegardées au lieu de window.env qui peut être écrasé
  console.log('🖥️ SESSION RDP:', _electronRDP ? 'OUI' : 'NON');
  console.log('📦 Version app:', _electronVersion);
  
  // Restaurer window.env.versions.app si elle a été écrasée
  if (window.env && window.env.versions && !window.env.versions.app) {
    window.env.versions.app = _electronVersion;
    console.log('✅ Version restaurée dans window.env');
  }
  
  if (_electronRDP) {
    console.log('🔧 APPLICATION DES CORRECTIFS RDP');
    
    // Demander les permissions media au démarrage pour forcer la détection
    setTimeout(() => {
      console.log('🎤 Demande de permissions media...');
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          console.log('✅ Permissions accordées, arrêt du stream');
          stream.getTracks().forEach(track => track.stop());
          
          // Re-énumérer les devices après avoir obtenu les permissions
          return navigator.mediaDevices.enumerateDevices();
        })
        .then(devices => {
          const audioInputs = devices.filter(d => d.kind === 'audioinput');
          const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
          console.log(`🎤 APRÈS PERMISSIONS - Inputs: ${audioInputs.length}, Outputs: ${audioOutputs.length}`);
          audioInputs.forEach(d => console.log('  📥 Input:', d.label || d.deviceId));
          audioOutputs.forEach(d => console.log('  📤 Output:', d.label || d.deviceId));
        })
        .catch(err => console.error('❌ Erreur permissions media:', err));
    }, 1000);
    
    // Polling des devices toutes les 5 secondes
    setInterval(() => {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices()
          .then(devices => {
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
            console.log(`🔄 Polling devices: ${audioInputs.length} inputs, ${audioOutputs.length} outputs`);
          })
          .catch(err => console.error('❌ Erreur énumération:', err));
      }
    }, 5000);
    
    // Forcer l'édition des champs
    setTimeout(() => {
      console.log('🔓 Activation de l\'édition des champs...');
      document.querySelectorAll('input, textarea, select').forEach(el => {
        if (!el.hasAttribute('readonly') && !el.hasAttribute('disabled')) {
          el.style.pointerEvents = 'auto';
          el.style.userSelect = 'text';
        }
      });
    }, 2000);
  }
});

// Read
//window.electron.dbGet('example_setting').then(value => {
//  console.log('example_setting =', value)
//})

// Write
//window.electron.dbSet('example_setting', 'foo')

// Open file dialog
//window.electron.openDialog({ properties: ['openFile'] }).then(result => {
//  if (!result.canceled) console.log('selected', result.filePaths)
//})


/**
 * SipApp - Electron Desktop Application - Preload Script
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
  bringToFront: () => ipcRenderer.invoke('incoming-call')
})

const packageInfo = require('./package.json');

contextBridge.exposeInMainWorld('env', {
  isElectron: true,
  versions: {
    app: packageInfo.version,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
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


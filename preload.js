const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // DB helpers
  dbGet: (key) => ipcRenderer.invoke('db-get', key),
  dbSet: (key, value) => ipcRenderer.invoke('db-set', key, value),
  // Dialog
  openDialog: (opts) => ipcRenderer.invoke('show-open-dialog', opts),
  // Generic IPC
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, cb) => ipcRenderer.on(channel, (evt, ...args) => cb(...args)),
  // Convenience: signal incoming call to bring app to front
  incomingCall: () => ipcRenderer.invoke('incoming-call'),
  bringToFront: () => ipcRenderer.invoke('incoming-call')
})

contextBridge.exposeInMainWorld('env', {
  isElectron: true
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


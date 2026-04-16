const { contextBridge, ipcRenderer } = require('electron');

// Offline mode + connectivity
contextBridge.exposeInMainWorld('restpos', {
  isElectron: true,
  onConnectivityChange: (callback) => {
    ipcRenderer.on('connectivity-changed', (_event, isOnline) => callback(isOnline));
  },
  getServerUrl: () => ipcRenderer.sendSync('get-server-url'),
});

// Local printing (from GDL)
contextBridge.exposeInMainWorld('electronPrint', {
  printComanda: (data) => ipcRenderer.invoke('print:comanda', data),
  printReceipt: (data) => ipcRenderer.invoke('print:receipt', data),
  testPrinter: (target) => ipcRenderer.invoke('print:test', target),
  isElectron: true,
});

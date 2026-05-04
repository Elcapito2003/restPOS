const { contextBridge, ipcRenderer } = require('electron');

// Offline mode + connectivity
contextBridge.exposeInMainWorld('restpos', {
  isElectron: true,
  onConnectivityChange: (callback) => {
    ipcRenderer.on('connectivity-changed', (_event, isOnline) => callback(isOnline));
  },
  getServerUrl: () => ipcRenderer.sendSync('get-server-url'),
  // Notifica al main si hay turno(s) abierto(s) — el main usa esto para bloquear el cierre
  // de la ventana hasta que se cierren los turnos o el usuario confirme.
  setShiftStatus: (hasOpenShift) => ipcRenderer.send('shift:status-changed', !!hasOpenShift),
});

// Local printing (from GDL)
contextBridge.exposeInMainWorld('electronPrint', {
  printComanda: (data) => ipcRenderer.invoke('print:comanda', data),
  printReceipt: (data) => ipcRenderer.invoke('print:receipt', data),
  testPrinter: (target) => ipcRenderer.invoke('print:test', target),
  openCashDrawer: (data) => ipcRenderer.invoke('print:open-drawer', data),
  scanPrinters: () => ipcRenderer.invoke('printer:scan'),
  identifyPrinter: (data) => ipcRenderer.invoke('printer:identify', data),
  isElectron: true,
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronPrint', {
  printComanda: (data) => ipcRenderer.invoke('print:comanda', data),
  printReceipt: (data) => ipcRenderer.invoke('print:receipt', data),
  testPrinter: (target) => ipcRenderer.invoke('print:test', target),
  isElectron: true,
});

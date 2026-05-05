const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');
const { setupPrintHandlers } = require('./localPrinter');
const { setupHandlers: setupFingerprintHandlers, closeAll: closeFingerprint } = require('./fingerprint');

// Cloud backend URL
const SERVER_URL = 'https://restpos.ai';

let mainWindow;
let relojWindow;
let isOnline = true;

// ─── Auto-updater ───
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', `Nueva versión ${info.version} disponible. Descargando...`);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización lista',
      message: `RestPOS v${info.version} está lista. La app se reiniciará para actualizar.`,
      buttons: ['Reiniciar ahora', 'Después'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
});

autoUpdater.on('error', (err) => {
  console.log('Auto-updater error:', err.message);
});

// ─── Connectivity monitor ───

function checkConnectivity() {
  const url = new URL('/api/health', SERVER_URL);
  const req = http.get(url.toString(), { timeout: 5000 }, (res) => {
    const wasOffline = !isOnline;
    isOnline = res.statusCode === 200;
    if (wasOffline && isOnline && mainWindow) {
      mainWindow.webContents.send('connectivity-changed', true);
    }
  });
  req.on('error', () => {
    const wasOnline = isOnline;
    isOnline = false;
    if (wasOnline && mainWindow) {
      mainWindow.webContents.send('connectivity-changed', false);
    }
  });
  req.on('timeout', () => {
    req.destroy();
    const wasOnline = isOnline;
    isOnline = false;
    if (wasOnline && mainWindow) {
      mainWindow.webContents.send('connectivity-changed', false);
    }
  });
}

// IPC handlers
ipcMain.on('get-server-url', (event) => {
  event.returnValue = SERVER_URL;
});

// ─── Shift status (bloquea cierre si hay turno abierto) ───
let hasOpenShift = false;
let confirmedClose = false;

ipcMain.on('shift:status-changed', (_event, hasShift) => {
  hasOpenShift = !!hasShift;
});

// ─── Window ───

function getClientPath() {
  const resourcePath = path.join(process.resourcesPath, 'client', 'index.html');
  const devPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  try {
    require('fs').accessSync(resourcePath);
    return resourcePath;
  } catch {
    try {
      require('fs').accessSync(devPath);
      return devPath;
    } catch {
      return null;
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'RestPOS',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
    },
  });

  // Atajo F12 para abrir/cerrar DevTools (necesario para soporte y debug)
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'RestPOS',
      submenu: [
        { label: 'Recargar', accelerator: 'F5', click: () => mainWindow.webContents.reload() },
        { label: 'DevTools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() },
        { label: 'Pantalla Completa', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { label: 'Abrir en Navegador', click: () => shell.openExternal(SERVER_URL) },
        { type: 'separator' },
        { label: 'Salir', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  // Open DevTools with F12
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') mainWindow.webContents.toggleDevTools();
  });

  // Try to load local client first (for offline support)
  const localClient = getClientPath();
  if (localClient) {
    mainWindow.loadFile(localClient);
  } else {
    mainWindow.loadURL(SERVER_URL).catch(() => {
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html><html><head><style>
          body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f1f5f9; color: #334155; }
          .box { text-align: center; max-width: 400px; padding: 40px; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          p { color: #64748b; margin-bottom: 24px; }
          button { background: #2563eb; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; }
        </style></head><body>
          <div class="box">
            <h1>Sin conexion</h1>
            <p>No se pudo conectar al servidor. Verifica tu internet.</p>
            <button onclick="location.reload()">Reintentar</button>
          </div>
        </body></html>
      `)}`);
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(SERVER_URL) && !url.startsWith('file://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Interceptar cierre cuando hay turno abierto
  mainWindow.on('close', (e) => {
    if (hasOpenShift && !confirmedClose) {
      e.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Turno abierto',
        message: '¿Seguro que quieres cerrar la aplicación?',
        detail: 'Hay un turno abierto. Lo recomendable es cerrarlo desde el menú "Cerrar turno" antes de salir, para llevar el control correcto de la caja.',
        buttons: ['Cancelar', 'Cerrar de todas formas'],
        defaultId: 0,
        cancelId: 0,
      }).then((result) => {
        if (result.response === 1) {
          confirmedClose = true;
          mainWindow.close();
        }
      });
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  checkConnectivity();
  setInterval(checkConnectivity, 10000);

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);
}

// ─── Ventana del reloj checador ───
// Ventana secundaria que carga /reloj y se queda escuchando huellas mientras
// la ventana principal sigue siendo usada normalmente por la gerenta/cajero.
// Se abre por defecto al iniciar la app (preferencia persistida en localStorage
// del renderer y también en electron-settings simple via archivo en userData).

const settingsFile = require('path').join(app.getPath('userData'), 'restpos-settings.json');
function loadSettings() {
  try { return JSON.parse(require('fs').readFileSync(settingsFile, 'utf-8')); } catch { return {}; }
}
function saveSettings(s) {
  try { require('fs').writeFileSync(settingsFile, JSON.stringify(s)); } catch {}
}

function createRelojWindow() {
  if (relojWindow && !relojWindow.isDestroyed()) {
    relojWindow.show();
    relojWindow.focus();
    return relojWindow;
  }

  // Posicionar la ventana del reloj en la esquina superior derecha de la pantalla
  // primaria. Si hay 2 monitores, abrir en el secundario.
  const { screen } = require('electron');
  const displays = screen.getAllDisplays();
  const target = displays.length > 1 ? displays[1] : displays[0];
  const w = 480, h = 720;
  const x = target.bounds.x + target.bounds.width - w - 20;
  const y = target.bounds.y + 60;

  relojWindow = new BrowserWindow({
    width: w,
    height: h,
    x, y,
    title: 'RestPOS — Reloj checador',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    minimizable: true,
    maximizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
    },
  });

  const localClient = getClientPath();
  if (localClient) {
    relojWindow.loadFile(localClient, { hash: '/reloj?kiosk=1' });
  } else {
    relojWindow.loadURL(`${SERVER_URL}/#/reloj?kiosk=1`);
  }

  relojWindow.on('closed', () => { relojWindow = null; });
  return relojWindow;
}

ipcMain.handle('reloj:open', () => { createRelojWindow(); return { ok: true }; });
ipcMain.handle('reloj:close', () => { if (relojWindow) relojWindow.close(); return { ok: true }; });
ipcMain.handle('reloj:is-open', () => ({ open: !!(relojWindow && !relojWindow.isDestroyed()) }));
ipcMain.handle('reloj:get-auto-open', () => ({ enabled: !!loadSettings().relojAutoOpen }));
ipcMain.handle('reloj:set-auto-open', (_e, enabled) => {
  saveSettings({ ...loadSettings(), relojAutoOpen: !!enabled });
  if (enabled) createRelojWindow();
  else if (relojWindow) relojWindow.close();
  return { ok: true };
});

// Setup local print handlers
setupPrintHandlers();
setupFingerprintHandlers();

app.whenReady().then(() => {
  createWindow();
  // Si el admin habilitó auto-abrir el reloj checador, lanzarlo después de
  // 2 seg para dejar que la ventana principal cargue primero.
  if (loadSettings().relojAutoOpen) {
    setTimeout(() => createRelojWindow(), 2000);
  }
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { try { closeFingerprint(); } catch {} });
app.on('activate', () => { if (!mainWindow) createWindow(); });

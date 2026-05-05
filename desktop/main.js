const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');
const { setupPrintHandlers } = require('./localPrinter');

// Cloud backend URL
const SERVER_URL = 'https://restpos.ai';

let mainWindow;
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
    },
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'RestPOS',
      submenu: [
        { label: 'Recargar', accelerator: 'F5', click: () => mainWindow.webContents.reload() },
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

// Setup local print handlers
setupPrintHandlers();

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!mainWindow) createWindow(); });

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { setupPrintHandlers } = require('./localPrinter');

// Server URL - uses droplet directly
const SERVER_URL = 'https://165.227.121.235';

let mainWindow;

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

  // Custom menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'RestPOS',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'F5',
          click: () => mainWindow.webContents.reload(),
        },
        {
          label: 'Pantalla Completa',
          accelerator: 'F11',
          click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()),
        },
        { type: 'separator' },
        {
          label: 'Abrir en Navegador',
          click: () => shell.openExternal(SERVER_URL),
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  // Load the app
  mainWindow.loadURL(SERVER_URL).catch(() => {
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f1f5f9; color: #334155; }
          .box { text-align: center; max-width: 400px; padding: 40px; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          p { color: #64748b; margin-bottom: 24px; }
          button { background: #2563eb; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; }
          button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Sin conexion</h1>
          <p>No se pudo conectar al servidor RestPOS. Verifica tu conexion a internet.</p>
          <button onclick="location.reload()">Reintentar</button>
        </div>
      </body>
      </html>
    `)}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(SERVER_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup local print handlers
setupPrintHandlers();

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});

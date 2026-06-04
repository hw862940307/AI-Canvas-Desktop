const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'NV Node Pro - Desktop',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
    // Set icon if available
    icon: path.join(__dirname, 'public/favicon.ico'),
  });

  // Remove menu bar
  win.setMenuBarVisibility(false);

  // In development, load from the local dev server
  // In production, we'd load the bundled files
  const startUrl = 'http://127.0.0.1:3000';
  
  if (isDev) {
    win.loadURL(startUrl);
    // Open DevTools in development
    win.webContents.openDevTools();
  } else {
    // If we have a build, we could use path.join(__dirname, 'dist/index.html')
    // But since the project is a full-stack App, we usually want it to talk to the local express server
    win.loadURL(startUrl);
  }

  // Automatic retry on connection failure (e.g. if dev server is booting a bit slowly)
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL.startsWith('http://127.0.0.1:3000')) {
      console.log(`[Electron] Startup connection waiting: ${errorDescription}. Retrying page load in 2s...`);
      setTimeout(() => {
        if (!win.isDestroyed()) {
          win.loadURL(startUrl);
        }
      }, 2000);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

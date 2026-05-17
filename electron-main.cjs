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
    },
    // Set icon if available
    icon: path.join(__dirname, 'public/favicon.ico'),
  });

  // Remove menu bar
  win.setMenuBarVisibility(false);

  // In development, load from the local dev server
  // In production, we'd load the bundled files
  if (isDev) {
    win.loadURL('http://localhost:3000');
    // Open DevTools in development
    win.webContents.openDevTools();
  } else {
    // If we have a build, we could use path.join(__dirname, 'dist/index.html')
    // But since the project is a full-stack App, we usually want it to talk to the local express server
    win.loadURL('http://localhost:3000');
  }
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

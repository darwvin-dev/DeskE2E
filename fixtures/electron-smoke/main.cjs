const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 640,
    height: 440,
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());

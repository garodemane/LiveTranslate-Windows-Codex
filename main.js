const { app, BrowserWindow, session, desktopCapturer } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1040,
    height: 780,
    minWidth: 780,
    minHeight: 560,
    title: 'Live Translate',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  const ses = session.defaultSession;
  const allowed = ['media', 'display-capture', 'audioCapture'];
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.includes(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => allowed.includes(permission));

  ses.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      callback({ video: sources[0], audio: 'loopback' });
    } catch (e) {
      callback(null);
    }
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

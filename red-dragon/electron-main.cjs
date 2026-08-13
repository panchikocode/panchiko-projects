/* =========================================================================
   electron-main.cjs — desktop shell around the cartridge.

   The game itself is untouched: this loads the same index.html the browser
   build uses, in a window sized to the 384x216 viewport's aspect ratio.
   ========================================================================= */
'use strict';

const { app, BrowserWindow, Menu, globalShortcut } = require('electron');
const path = require('path');

/* If ELECTRON_RUN_AS_NODE is set in the environment, Electron boots as a
   plain Node process and require('electron') hands back the path to the
   binary instead of the API — every destructured name above is undefined.
   VS Code sets that variable for its child processes, so launching this
   from an integrated terminal fails with a confusing TypeError. Say what
   actually went wrong instead. */
if (!app) {
  console.error(
    'This build must run as an Electron app, not as Node.\n' +
    'ELECTRON_RUN_AS_NODE is set in the environment (VS Code sets it for\n' +
    'child processes). Clear it, or launch the executable from Explorer.'
  );
  process.exit(1);
}

/* The game renders at 384x216 and scales with Phaser.Scale.FIT, so any
   16:9 window works; 1152x648 is 3x the native resolution. */
const NATIVE_W = 384;
const NATIVE_H = 216;
const SCALE = 3;

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: NATIVE_W * SCALE,
    height: NATIVE_H * SCALE,
    minWidth: NATIVE_W,
    minHeight: NATIVE_H,
    backgroundColor: '#05040a',
    title: 'Legend of the Red Dragon',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      /* the page is local and self-contained; nothing here needs node */
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));

  /* avoid the white flash before the first frame is painted */
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  createWindow();

  /* F11 fullscreen, Ctrl+R reload — the two things a menu-less window
     otherwise loses. DevTools stays on F12 for debugging a packaged build. */
  globalShortcut.register('F11', () => {
    if (win) win.setFullScreen(!win.isFullScreen());
  });
  globalShortcut.register('F12', () => {
    if (win) win.webContents.toggleDevTools();
  });
  globalShortcut.register('CommandOrControl+R', () => {
    if (win) win.reload();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => globalShortcut.unregisterAll());

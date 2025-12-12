const { app, BrowserWindow } = require('electron');
const path = require('path');

// CRITICAL FIX: Force V8 to run in interpreter mode without JIT to prevent SIGTRAP crashes
// Set environment variables BEFORE any other Electron code runs
// process.env.ELECTRON_RUN_AS_NODE = '0';
// process.env.ELECTRON_DISABLE_SANDBOX = '1';

// Apply comprehensive V8 and Chromium flags to maximize stability
// app.commandLine.appendSwitch('no-sandbox');
// app.commandLine.appendSwitch('disable-gpu');
// app.commandLine.appendSwitch('disable-software-rasterizer');
// app.commandLine.appendSwitch('disable-dev-shm-usage');
// app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
// app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
// app.commandLine.appendSwitch('js-flags', '--jitless --no-opt --no-turbo --no-concurrent-recompilation');

// Disable all hardware acceleration
app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js') // Optional if needed later
        },
        titleBarStyle: 'default',
        backgroundColor: '#ffffff'
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

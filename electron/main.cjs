const { app, BrowserWindow } = require('electron');
const path = require('path');

// FORCE FIX: Disable JIT compilation and Optimization via js-flags to ensure V8 runs in interpreter mode
// This is critical for preventing V8 compiler crashes on macOS ARM64 (M4)
// Also disabling sandbox as an extra compatibility layer
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('js-flags', '--jitless --no-opt --max-old-space-size=4096');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.disableHardwareAcceleration(); // Disable GPU acceleration for stability

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

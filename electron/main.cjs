const { app, BrowserWindow, dialog } = require('electron');

app.disableHardwareAcceleration();

function getAppURL() {
    if (!app.isPackaged) return new URL('http://localhost:5173');
    const value = process.env.EWHA_APP_URL || 'https://y2-consulting.web.app';
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error('EWHA_APP_URL에 올바른 HTTPS 주소를 입력해주세요.');
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('EWHA_APP_URL에는 사용자 정보가 없는 HTTPS 주소를 입력해주세요.');
    }
    return url;
}

async function createWindow() {
    const appURL = getAppURL();
    const window = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
        titleBarStyle: 'default',
        backgroundColor: '#ffffff',
    });

    // Keep authentication and API requests on the configured service origin.
    const restrictNavigation = (event, destination) => {
        try {
            if (new URL(destination).origin === appURL.origin) return;
        } catch {
            // Invalid destinations are blocked too.
        }
        event.preventDefault();
    };
    window.webContents.on('will-navigate', restrictNavigation);
    window.webContents.on('will-redirect', restrictNavigation);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    await window.loadURL(appURL.href);
}

function showLaunchError(error) {
    dialog.showErrorBox('앱을 열 수 없습니다', error.message);
    app.quit();
}

app.whenReady().then(createWindow).catch(showLaunchError);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (app.isReady() && BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch(showLaunchError);
    }
});

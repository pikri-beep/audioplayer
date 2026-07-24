const { BrowserWindow, nativeImage, Menu, Tray, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const state = require('./state');

function safeSend(windowObj, channel, ...args) {
    if (windowObj && !windowObj.isDestroyed() && windowObj.webContents && !windowObj.webContents.isDestroyed()) {
        windowObj.webContents.send(channel, ...args);
    }
}

function updateThumbar(isPlaying) {
    try {
        if (state.win && !state.win.isDestroyed()) {
            state.win.setThumbarButtons([
                {
                    tooltip: "Previous",
                    icon: nativeImage.createFromPath(
                        path.join(__dirname, "../../assets/icons/previous.png")
                    ),
                    click() {
                        if (state.win && !state.win.isDestroyed()) {
                            safeSend(state.win, "thumb-prev");
                        }
                    }
                },
                {
                    tooltip: isPlaying ? "Pause" : "Play",
                    icon: nativeImage.createFromPath(
                        path.join(
                            __dirname,
                            isPlaying
                                ? "../../assets/icons/pause.png"
                                : "../../assets/icons/play.png"
                        )
                    ),
                    click() {
                        if (state.win && !state.win.isDestroyed()) {
                            safeSend(state.win, "thumb-play");
                        }
                    }
                },
                {
                    tooltip: "Next",
                    icon: nativeImage.createFromPath(
                        path.join(__dirname, "../../assets/icons/next.png")
                    ),
                    click() {
                        if (state.win && !state.win.isDestroyed()) {
                            safeSend(state.win, "thumb-next");
                        }
                    }
                }
            ]);
        }
    } catch (e) {
        console.error("Gagal updateThumbar:", e.message);
    }
}

function createWindow() {
    state.win = new BrowserWindow({
        width: 420,
        height: 650,
        minWidth: 280,
        minHeight: 450,
        resizable: true,
        frame: false, // frameless window kustom
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../../assets', 'logo.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false
        }
    });

    state.win.loadFile(path.join(__dirname, '../../index.html'));

    state.win.on('close', (event) => {
        if (!state.isQuiting && state.isTrayEnabled) {
            event.preventDefault();
            state.win.hide();
        }
    });

    state.win.on('closed', () => {
        try {
            if (state.miniWin && !state.miniWin.isDestroyed()) {
                state.miniWin.destroy();
            }
        } catch (e) {
            console.error("Gagal destroy miniWin:", e.message);
        }
        state.win = null;
    });
}

function createNotificationWindow() {
    state.notificationWin = new BrowserWindow({
        width: 320,
        height: 90,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        focusable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    state.notificationWin.loadFile(
        path.join(__dirname, "../../notification/notification.html")
    );

    const area = screen.getPrimaryDisplay().workAreaSize;
    state.notificationWin.setPosition(
        area.width - 335,
        area.height - 105
    );
}

function showLiveCard(song) {
    if (!state.notificationEnabled) return;

    if (!state.notificationWin || state.notificationWin.isDestroyed()) {
        createNotificationWindow();
    }

    if (state.notificationWin && !state.notificationWin.isDestroyed()) {
        try {
            state.notificationWin.show();
        } catch (e) {
            console.warn("Gagal show notificationWin:", e.message);
        }

        safeSend(state.notificationWin, "song-data", song);

        clearTimeout(state.notificationWin.hideTimer);

        state.notificationWin.hideTimer = setTimeout(() => {
            try {
                if (state.notificationWin && !state.notificationWin.isDestroyed()) {
                    state.notificationWin.hide();
                }
            } catch (e) {
                console.warn("Gagal hide notificationWin:", e.message);
            }
        }, 4000);
    }
}

module.exports = {
    safeSend,
    updateThumbar,
    createWindow,
    createNotificationWindow,
    showLiveCard
};

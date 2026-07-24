const { ipcMain, BrowserWindow, nativeImage, Menu, Tray, screen, app } = require('electron');
const path = require('path');
const state = require('./state');
const { safeSend, updateThumbar, showLiveCard, createNotificationWindow } = require('./windowManager');

function registerIpcListeners() {
    // 1. Mini Player toggle
    ipcMain.on('toggle-mini-player', (event, isMiniMode) => {
        if (isMiniMode) {
            if (state.win && !state.win.isDestroyed()) state.win.hide();
            
            if (!state.miniWin || state.miniWin.isDestroyed()) {
                state.miniWin = new BrowserWindow({
                    width: 340, 
                    height: 110,
                    frame: false,
                    transparent: true,
                    alwaysOnTop: true,
                    resizable: false,
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                });
                state.miniWin.loadFile(path.join(__dirname, '../../mini.html'));
                
                state.miniWin.on('moved', () => {
                    if (state.miniWin && !state.miniWin.isDestroyed()) {
                        const bounds = state.miniWin.getBounds();
                        const display = screen.getDisplayMatching(bounds);
                        const workArea = display.workArea;

                        let newX = bounds.x;
                        let newY = bounds.y;

                        if (bounds.x < workArea.x) newX = workArea.x;
                        else if (bounds.x + bounds.width > workArea.x + workArea.width) newX = workArea.x + workArea.width - bounds.width;

                        if (bounds.y < workArea.y) newY = workArea.y;
                        else if (bounds.y + bounds.height > workArea.y + workArea.height) newY = workArea.y + workArea.height - bounds.height;

                        if (newX !== bounds.x || newY !== bounds.y) {
                            state.miniWin.setPosition(newX, newY);
                        }
                    }
                });

                state.miniWin.on('closed', () => { state.miniWin = null; });
            } else {
                state.miniWin.show();
            }
            
            if (state.win && !state.win.isDestroyed()) {
                safeSend(state.win, 'request-state-for-mini');
            }
            
        } else {
            if (state.miniWin && !state.miniWin.isDestroyed()) state.miniWin.hide();
            if (state.win && !state.win.isDestroyed()) state.win.show();
        }
    });

    // 2. Sync Mini Player data
    ipcMain.on('sync-mini-player', (event, data) => {
        safeSend(state.miniWin, 'update-mini-player', data);
    });

    // 3. Action from Mini Player
    ipcMain.on('mini-action', (event, action) => {
        if (action === 'expand') {
            if (state.miniWin && !state.miniWin.isDestroyed()) state.miniWin.hide();
            if (state.win && !state.win.isDestroyed()) {
                state.win.show();
                safeSend(state.win, 'set-mini-mode', false);
            }
        } else if (action === 'play') {
            if (state.win && !state.win.isDestroyed()) safeSend(state.win, 'thumb-play'); 
        } else if (action === 'next') {
            if (state.win && !state.win.isDestroyed()) safeSend(state.win, 'thumb-next');
        } else if (action === 'prev') {
            if (state.win && !state.win.isDestroyed()) safeSend(state.win, 'thumb-prev');
        }
    });

    // 4. Player state (Thumbar update)
    ipcMain.on("player-state", (_, playing) => {
        updateThumbar(playing);
    });

    // 5. Notifications IPCs
    ipcMain.on("show-notification", (_, song) => {
        showLiveCard(song);
    });

    ipcMain.on("toggle-notification", (_, enabled) => {
        state.notificationEnabled = enabled;
    });

    // 6. Mini notification window button click IPCs
    ipcMain.on("live-prev", () => {
        if (state.win && !state.win.isDestroyed()) {
            safeSend(state.win, "thumb-prev");
        }
    });

    ipcMain.on("live-play", () => {
        if (state.win && !state.win.isDestroyed()) {
            safeSend(state.win, "thumb-play");
        }
    });

    ipcMain.on("live-next", () => {
        if (state.win && !state.win.isDestroyed()) {
            safeSend(state.win, "thumb-next");
        }
    });

    // 7. System Tray IPCs
    ipcMain.on("toggle-tray", (_, enabled) => {
        state.isTrayEnabled = enabled;

        if (enabled) {
            if (!state.tray || state.tray.isDestroyed()) {
                const icon = nativeImage.createFromPath(
                    path.join(__dirname, "../../assets/logo.png")
                );
                state.tray = new Tray(icon);
                state.tray.setToolTip("NJOY Music");
                state.tray.setContextMenu(
                    Menu.buildFromTemplate([
                        {
                            label: "🎵 Buka Player",
                            click() {
                                if (state.win && !state.win.isDestroyed()) {
                                    state.win.show();
                                }
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "❌ Keluar",
                            click() {
                                state.isQuiting = true;
                                app.quit();
                            }
                        }
                    ])
                );
                state.tray.on("click", () => {
                    if (state.win && !state.win.isDestroyed()) {
                        if (state.win.isMinimized()) {
                            state.win.restore();
                            state.win.focus();
                        } else if (state.win.isVisible()) {
                            state.win.hide();
                        } else {
                            state.win.show();
                            state.win.focus();
                        }
                    }
                });
            }
        } else {
            if (state.tray && !state.tray.isDestroyed()) {
                state.tray.destroy();
                state.tray = null;
            }
        }
    });

    // 8. Always On Top
    ipcMain.on("toggle-ontop", (_, enabled) => {
        state.isAlwaysOnTopSetting = enabled;
        if (state.win && !state.win.isDestroyed()) {
            state.win.setAlwaysOnTop(enabled);
        }
    });

    // 9. Window Controls kustom untuk Frameless Window
    ipcMain.on("window-minimize", () => {
        if (state.win && !state.win.isDestroyed()) {
            state.win.minimize();
        }
    });

    ipcMain.on("window-maximize", () => {
        if (state.win && !state.win.isDestroyed()) {
            if (state.win.isMaximized()) {
                state.win.unmaximize();
            } else {
                state.win.maximize();
            }
        }
    });

    ipcMain.on("window-close", () => {
        if (state.win && !state.win.isDestroyed()) {
            state.win.close();
        }
    });
}

module.exports = {
    registerIpcListeners
};

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
  screen
} = require('electron');

const path = require('path');
const fs = require('fs');

let win;
let tray;
let isQuiting = false;
let notificationWin = null;
let notificationEnabled = true;

function updateThumbar(isPlaying) {

    win.setThumbarButtons([
        {
            tooltip: "Previous",

            icon: nativeImage.createFromPath(
                path.join(__dirname, "assets/icons/previous.png")
            ),

            click() {
                win.webContents.send("thumb-prev");
            }
        },

        {
            tooltip: isPlaying ? "Pause" : "Play",

            icon: nativeImage.createFromPath(
                path.join(
                    __dirname,
                    isPlaying
                        ? "assets/icons/pause.png"
                        : "assets/icons/play.png"
                )
            ),

            click() {
                win.webContents.send("thumb-play");
            }
        },

        {
            tooltip: "Next",

            icon: nativeImage.createFromPath(
                path.join(__dirname, "assets/icons/next.png")
            ),

            click() {
                win.webContents.send("thumb-next");
            }
        }
    ]);

}

function createWindow () {
  win = new BrowserWindow({
    width: 420,
    height: 650,
    minWidth: 280,  
    minHeight: 450,
    resizable: true,
    autoHideMenuBar: true, 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  win.loadFile('index.html');

  // Kalau pencet X, jangan keluar, tapi sembunyikan ke tray
win.on("close", (e) => {
    if (!isQuiting) {
        e.preventDefault();
        win.hide();
    }
});
}

function createNotificationWindow() {

    notificationWin = new BrowserWindow({

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

    notificationWin.loadFile(
        path.join(__dirname, "notification", "notification.html")
    );

    const area = screen.getPrimaryDisplay().workAreaSize;

    notificationWin.setPosition(
        area.width - 335,
        area.height - 105
    );

}

function showLiveCard(song) {

    if (!notificationEnabled) return;

    if (!notificationWin) {

        createNotificationWindow();

    }

    notificationWin.show();

    notificationWin.webContents.send(
        "song-data",
        song
    );

    clearTimeout(notificationWin.hideTimer);

    notificationWin.hideTimer = setTimeout(() => {

        notificationWin.hide();

    }, 4000);

}

app.whenReady().then(() => {

    createWindow();
    createNotificationWindow();
    updateThumbar(false);

    // Pakai icon default Electron dulu
    const icon = nativeImage.createFromPath(
    path.join(__dirname, "assets", "logo.png")
);

tray = new Tray(icon);

    tray.setToolTip("Audio Player");

    tray.setContextMenu(
        Menu.buildFromTemplate([
            {
                label: "🎵 Buka Player",
                click() {
                    win.show();
                }
            },
            {
                type: "separator"
            },
            {
                label: "❌ Keluar",
                click() {
                    isQuiting = true;
                    app.quit();
                }
            }
        ])
    );

    tray.on("click", () => {
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
        }
    });

});

app.on("before-quit", () => {
    isQuiting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Listener untuk buka folder ambil file musik
ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }]
    });
    
    if (!result.canceled) {
        return result.filePaths;
    }
    return [];
});

ipcMain.handle('get-metadata', async (event, filePath) => {
    try {
        const mm = await import('music-metadata');
        const metadata = await mm.parseFile(filePath);
        
        let coverPath = null;
        
        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            // Simpan gambar ke folder temp aplikasi
            const tempPath = path.join(app.getPath('temp'), 'current-cover.jpg');
            fs.writeFileSync(tempPath, picture.data);
            coverPath = tempPath;
        }
        
        return {
            title: metadata.common.title,
            artist: metadata.common.artist,
            coverPath: coverPath // Cukup kirim path-nya saja!
        };
    } catch (error) {
        return null;
    }
});

// Tambahkan di main.js
ipcMain.handle('upload-custom-cover', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }]
    });
    
    if (!result.canceled) {
        const sourcePath = result.filePaths[0];
        const destPath = path.join(__dirname, 'covers', 'custom-cover.jpg');
        fs.copyFileSync(sourcePath, destPath);
        return destPath; // Kirim path gambar baru
    }
    return null;
});

ipcMain.on("player-state", (_, playing) => {
    updateThumbar(playing);
});

ipcMain.on("show-notification", (_, song) => {

    showLiveCard(song);

});

ipcMain.on("live-prev", () => {

    win.webContents.send("thumb-prev");

});

ipcMain.on("live-play", () => {

    win.webContents.send("thumb-play");

});

ipcMain.on("live-next", () => {

    win.webContents.send("thumb-next");

});

ipcMain.on("toggle-notification", (_, enabled) => {

    notificationEnabled = enabled;

});

ipcMain.on("toggle-tray", (_, enabled) => {

    if (enabled) {

        if (!tray) {

            const icon = nativeImage.createFromPath(
                path.join(__dirname, "assets", "logo.png")
            );

            tray = new Tray(icon);

            tray.setToolTip("NJOY Music");

            tray.setContextMenu(
                Menu.buildFromTemplate([
                    {
                        label: "🎵 Buka Player",
                        click() {
                            win.show();
                        }
                    },
                    {
                        type: "separator"
                    },
                    {
                        label: "❌ Keluar",
                        click() {
                            isQuiting = true;
                            app.quit();
                        }
                    }
                ])
            );

            tray.on("click", () => {

                if (win.isVisible())
                    win.hide();
                else
                    win.show();

            });

        }

    } else {

        if (tray) {

            tray.destroy();

            tray = null;

        }

    }

});

// Tambahkan listener ini di bagian bawah main.js bersama ipcMain lainnya
ipcMain.on("toggle-ontop", (_, enabled) => {
    if (win) {
        win.setAlwaysOnTop(enabled);
    }
});
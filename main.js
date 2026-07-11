const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
  screen,
  globalShortcut
} = require('electron');

const path = require('path');
const fs = require('fs');

let win;
let tray;
let isQuiting = false;
let isTrayEnabled = true;
let notificationWin = null;
let notificationEnabled = true;
let miniWin = null;

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
  ipcMain.on('toggle-mini-player', (event, isMiniMode) => {
    if (isMiniMode) {
        win.hide(); // Sembunyikan jendela utama
        
        if (!miniWin) {
            // Buat jendela widget baru yang frameless
            miniWin = new BrowserWindow({
                width: 320, 
                height: 100,
                frame: false, // Hilangkan bingkai/border Windows
                transparent: true, // Latar belakang tembus pandang
                alwaysOnTop: true, // Selalu di atas
                resizable: false,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });
            miniWin.loadFile('mini.html');
            
            // Hapus dari memori kalau ditutup
            miniWin.on('closed', () => { miniWin = null; });
        } else {
            miniWin.show();
        }
        
        // Minta jendela utama untuk mengirimkan data lagu saat ini ke widget
        win.webContents.send('request-state-for-mini');
        
    } else {
        if (miniWin) miniWin.hide();
        win.show(); // Tampilkan jendela utama lagi
    }
  });

  // Jembatan komunikasi: Menerima info lagu dari utama -> kirim ke widget
  ipcMain.on('sync-mini-player', (event, data) => {
      if (miniWin) {
          miniWin.webContents.send('update-mini-player', data);
      }
  });

  // Jembatan komunikasi: Menerima klik tombol dari widget -> suruh utama eksekusi
  ipcMain.on('mini-action', (event, action) => {
      if (action === 'expand') {
          if (miniWin) miniWin.hide();
          win.show();
          win.webContents.send('set-mini-mode', false); // Kembalikan icon compress
      } else if (action === 'play') {
          win.webContents.send('thumb-play'); 
      } else if (action === 'next') {
          win.webContents.send('thumb-next');
      } else if (action === 'prev') {
          win.webContents.send('thumb-prev');
      }
  });
  
// 1. Kasih tau Electron kalau kita emang beneran niat mau quit
app.on('before-quit', () => {
    isQuiting = true;
});

// 2. Logika nutup window
win.on('close', (event) => {
    // Kalau settingan Tray NYALA dan user gak ngeklik "Keluar" dari tray menu
    if (!isQuiting && isTrayEnabled) {
        event.preventDefault(); // Cegah window hancur
        win.hide();             // Sembunyiin aja
    }
    // Kalau Tray MATI, kita gak ngapa-ngapain di sini. 
    // Biarkan Electron menghancurkan window-nya secara alami.
});

// 3. Pas window-nya beneran hancur (karena tray mati), suruh app beneran berhenti (lagu mati)
app.on('window-all-closed', () => {
    // Kalau di Windows/Linux, semua window ketutup = matiin aplikasi
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
    app.on('will-quit', () => {
    // Lepaskan semua global shortcut agar tidak membajak keyboard PC pengguna
    globalShortcut.unregisterAll();
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

    globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.webContents.send("thumb-play");});
    globalShortcut.register('CommandOrControl+Right', () => {
    win.webContents.send("thumb-next");});
    globalShortcut.register('CommandOrControl+Left', () => {
    win.webContents.send("thumb-prev");});
    globalShortcut.register('CommandOrControl+M', () => { if (win) win.webContents.send('shortcut-mute'); });


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
ipcMain.handle('upload-custom-cover', async (event, songName) => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }]
    });
    
    if (!result.canceled) {
        const sourcePath = result.filePaths[0];
        // Sekarang file disimpan menggunakan NAMA LAGU biar spesifik!
        const destPath = path.join(__dirname, 'covers', `${songName}-cover.jpg`);
        fs.copyFileSync(sourcePath, destPath);
        return destPath; 
    }
    return null;
});

// TAMBAHKAN MESIN UNTUK MENGHAPUS COVER:
ipcMain.handle('remove-custom-cover', async (event, songName) => {
    const targetPath = path.join(__dirname, 'covers', `${songName}-cover.jpg`);
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath); // Hapus gambar custom dari komputer
        return true;
    }
    return false;
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
    isTrayEnabled = enabled;

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

ipcMain.on("toggle-ontop", (_, enabled) => {
    isAlwaysOnTopSetting = enabled; // Simpan memori
    if (win) {
        win.setAlwaysOnTop(enabled);
    }
});

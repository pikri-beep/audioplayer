process.on('unhandledRejection', (reason, promise) => {
    console.warn('[Unhandled Rejection]', reason);
});

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
app.setPath('userData', path.join(app.getPath('appData'), 'audioplayer-data'));

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    return;
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
    }
});

const fs = require('fs');
const ytSearch = require('yt-search');
const { exec } = require('child_process');

let win;
let tray;
let isQuiting = false;
let isTrayEnabled = true;
let notificationWin = null;
let notificationEnabled = true;
let miniWin = null;
let isAlwaysOnTopSetting = false;

function safeSend(windowObj, channel, ...args) { if (windowObj && !windowObj.isDestroyed() && windowObj.webContents && !windowObj.webContents.isDestroyed()) { windowObj.webContents.send(channel, ...args); } }



function updateThumbar(isPlaying) {
    try {
        if (win && !win.isDestroyed()) {
            win.setThumbarButtons([
                {
                    tooltip: "Previous",
                    icon: nativeImage.createFromPath(
                        path.join(__dirname, "assets/icons/previous.png")
                    ),
                    click() {
                        if (win && !win.isDestroyed()) {
                            safeSend(win, "thumb-prev");
                        }
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
                        if (win && !win.isDestroyed()) {
                            safeSend(win, "thumb-play");
                        }
                    }
                },

                {
                    tooltip: "Next",
                    icon: nativeImage.createFromPath(
                        path.join(__dirname, "assets/icons/next.png")
                    ),
                    click() {
                        if (win && !win.isDestroyed()) {
                            safeSend(win, "thumb-next");
                        }
                    }
                }
            ]);
        }
    } catch (e) {
        console.error("Gagal updateThumbar:", e.message);
    }
}

function createWindow () {
  win = new BrowserWindow({
    width: 420,
    height: 650,
    minWidth: 280,  
    minHeight: 450,
    resizable: true,
    autoHideMenuBar: true, 
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  win.loadFile('index.html');
  ipcMain.on('toggle-mini-player', (event, isMiniMode) => {
    if (isMiniMode) {
        if (win && !win.isDestroyed()) win.hide(); // Sembunyikan jendela utama
        
        if (!miniWin || miniWin.isDestroyed()) {
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
            miniWin.on('moved', () => {
                if (miniWin && !miniWin.isDestroyed()) {
                    const bounds = miniWin.getBounds();
                    const display = screen.getDisplayMatching(bounds);
                    const workArea = display.workArea; // Menghitung layar yang aman (tanpa taskbar)

                    let newX = bounds.x;
                    let newY = bounds.y;

                    // Cek Kiri - Kanan
                    if (bounds.x < workArea.x) newX = workArea.x;
                    else if (bounds.x + bounds.width > workArea.x + workArea.width) newX = workArea.x + workArea.width - bounds.width;

                    // Cek Atas - Bawah Taskbar
                    if (bounds.y < workArea.y) newY = workArea.y;
                    else if (bounds.y + bounds.height > workArea.y + workArea.height) newY = workArea.y + workArea.height - bounds.height;

                    // Kalau posisinya melanggar, jepret kembali ke posisi aman
                    if (newX !== bounds.x || newY !== bounds.y) {
                        miniWin.setPosition(newX, newY);
                    }
                }
            });

            // Hapus dari memori kalau ditutup
            miniWin.on('closed', () => { miniWin = null; });
        } else {
            miniWin.show();
        }
        
        // Minta jendela utama untuk mengirimkan data lagu saat ini ke widget
        if (win && !win.isDestroyed()) {
            safeSend(win, 'request-state-for-mini');
        }
        
    } else {
        if (miniWin && !miniWin.isDestroyed()) miniWin.hide();
        if (win && !win.isDestroyed()) win.show(); // Tampilkan jendela utama lagi
    }
  });

  // Jembatan komunikasi: Menerima info lagu dari utama -> kirim ke widget
  ipcMain.on('sync-mini-player', (event, data) => {
      safeSend(miniWin, 'update-mini-player', data);
  });

  // Jembatan komunikasi: Menerima klik tombol dari widget -> suruh utama eksekusi
  ipcMain.on('mini-action', (event, action) => {
      if (action === 'expand') {
          if (miniWin && !miniWin.isDestroyed()) miniWin.hide();
          if (win && !win.isDestroyed()) {
              win.show();
              safeSend(win, 'set-mini-mode', false); // Kembalikan icon compress
          }
      } else if (action === 'play') {
          if (win && !win.isDestroyed()) safeSend(win, 'thumb-play'); 
      } else if (action === 'next') {
          if (win && !win.isDestroyed()) safeSend(win, 'thumb-next');
      } else if (action === 'prev') {
          if (win && !win.isDestroyed()) safeSend(win, 'thumb-prev');
      }
  });

// 1. Kasih tau Electron kalau kita emang beneran niat mau quit
app.on('before-quit', () => { isQuiting = true; if (miniWin && !miniWin.isDestroyed()) miniWin.destroy(); if (notificationWin && !notificationWin.isDestroyed()) notificationWin.destroy(); if (tray && !tray.isDestroyed()) { tray.destroy(); tray = null; } });
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

win.on('closed', () => {
    try {
        if (miniWin && !miniWin.isDestroyed()) {
            miniWin.destroy();
        }
    } catch (e) {
        console.error("Gagal destroy miniWin:", e.message);
    }
    win = null;
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

    if (!notificationWin || notificationWin.isDestroyed()) {
        createNotificationWindow();
    }

    if (notificationWin && !notificationWin.isDestroyed()) {
        try {
            notificationWin.show();
        } catch (e) {
            console.warn("Gagal show notificationWin:", e.message);
        }

        safeSend(notificationWin, "song-data", song);

        clearTimeout(notificationWin.hideTimer);

        notificationWin.hideTimer = setTimeout(() => {
            try {
                if (notificationWin && !notificationWin.isDestroyed()) {
                    notificationWin.hide();
                }
            } catch (e) {
                console.warn("Gagal hide notificationWin:", e.message);
            }
        }, 4000);
    }

}

app.whenReady().then(() => {

    // Buat folder covers jika belum ada
    const coversFolder = path.join(__dirname, 'covers');
    if (!fs.existsSync(coversFolder)) {
        fs.mkdirSync(coversFolder);
    }

    // Buat folder songs jika belum ada
    const songsFolder = path.join(__dirname, 'songs');
    if (!fs.existsSync(songsFolder)) {
        fs.mkdirSync(songsFolder);
    }

    createWindow();
    createNotificationWindow();
    updateThumbar(false);
    checkSystemRequirements();

    function checkSystemRequirements() {
        exec('yt-dlp --version', (error) => {
            if (error) {
                dialog.showMessageBox({
                    type: 'warning',
                    title: 'NJOY Warning - yt-dlp Tidak Ditemukan',
                    message: 'Waduh! NJOY butuh "yt-dlp" untuk mengunduh lagu dari YouTube.\n\nSilakan instal yt-dlp terlebih dahulu agar fitur unduh YouTube berfungsi.',
                });
            }
        });

        exec('python -m spotdl --version', (error) => {
            if (error) {
                dialog.showMessageBox({
                    type: 'warning',
                    title: 'NJOY Warning - Python/SpotDL Tidak Ditemukan',
                    message: 'Waduh! NJOY butuh Python dan SpotDL untuk mengunduh lagu dari Spotify.\n\nSilakan instal Python (tambahkan ke PATH) & ketik "pip install spotdl" di terminal Anda.',
                });
            }
        });
    }

    globalShortcut.register('CommandOrControl+Shift+Space', () => {
        if (win && !win.isDestroyed()) {
            safeSend(win, "thumb-play");
        }
    });
    globalShortcut.register('CommandOrControl+Right', () => {
        if (win && !win.isDestroyed()) {
            safeSend(win, "thumb-next");
        }
    });
    globalShortcut.register('CommandOrControl+Left', () => {
        if (win && !win.isDestroyed()) {
            safeSend(win, "thumb-prev");
        }
    });
    globalShortcut.register('CommandOrControl+M', () => {
        if (win && !win.isDestroyed()) {
            safeSend(win, 'shortcut-mute');
        }
    });



});

// Listener untuk buka folder ambil file musik
ipcMain.handle('open-file-dialog', async () => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }]
        });
        
        if (!result.canceled) {
            return result.filePaths;
        }
    } catch (err) {
        console.error("Gagal open-file-dialog:", err.message);
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
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'gif'] }]
        });
        
        if (!result.canceled) {
            const sourcePath = result.filePaths[0];
            // Sekarang file disimpan menggunakan NAMA LAGU biar spesifik!
            const destPath = path.join(__dirname, 'covers', `${songName}-cover.jpg`);
            fs.copyFileSync(sourcePath, destPath);
            return destPath; 
        }
    } catch (err) {
        console.error("Gagal upload-custom-cover:", err.message);
    }
    return null;
});

// TAMBAHKAN MESIN UNTUK MENGHAPUS COVER:
ipcMain.handle('remove-custom-cover', async (event, songName) => {
    try {
        const targetPath = path.join(__dirname, 'covers', `${songName}-cover.jpg`);
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath); // Hapus gambar custom dari komputer
            return true;
        }
    } catch (err) {
        console.error("Gagal remove-custom-cover:", err.message);
    }
    return false;
});

// =========================================================
// MESIN YOUTUBE SEARCH & DOWNLOAD
// =========================================================

// 1. Fungsi Pencarian YouTube (Versi Anti-Crash & Super Safe)
ipcMain.handle('search-yt', async (event, query) => {
    try {
        console.log(`\n🔍 [NJOY Search] Mencari di YouTube untuk: "${query}"`);
        
        // Menggunakan pemanggilan tipe objek (paling aman untuk library yt-search terbaru)
        const r = await ytSearch({ query: query });
        
        if (!r || !r.videos || r.videos.length === 0) {
            console.warn("⚠️ [NJOY Search] Hasil pencarian kosong dari YouTube.");
            return [];
        }

        // Batasi hanya mengambil 5 hasil teratas
        const videos = r.videos.slice(0, 5); 
        
        // Mapping dengan pertahanan penuh (Defensive Programming)
        return videos.map(v => {
            // YouTube sering mengubah penamaan thumbnail, kita amankan dengan fallback
            const thumbnailSrc = v.image || v.thumbnail || "assets/logo.png";
            
            // Cegah error TypeError: Cannot read properties of undefined (reading 'name')
            const channelName = (v.author && v.author.name) ? v.author.name : "Unknown Channel";
            
            return {
                title: v.title || "Untitled Video",
                author: channelName,
                timestamp: v.timestamp || "0:00",
                thumbnail: thumbnailSrc,
                url: v.url || ""
            };
        });
    } catch (err) {
        // Tampilkan error mendetail di terminal VS Code biar mudah kita diagnosa jika ada masalah jaringan
        console.error("❌ [NJOY Search Error] Gagal melakukan pencarian:", err.message);
        return [];
    }
});


// 2. Fungsi Download YT-DLP
ipcMain.handle('download-yt', async (event, url) => {
    return new Promise((resolve, reject) => {
        // BUG FIX: Tambahkan uploader (Artis) di nama file agar unik!
        const outputTemplate = path.join(__dirname, 'songs', '%(uploader)s - %(title)s.%(ext)s');
        const command = `yt-dlp -x --audio-format mp3 --embed-metadata --embed-thumbnail -o "${outputTemplate}" "${url}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Gagal download: ${error.message}`);
                resolve({ success: false, error: error.message });
                return;
            }
            resolve({ success: true });
        });
    });
});

// =========================================================
// MESIN SPOTIFY DOWNLOADER (SPOTDL)
// =========================================================
ipcMain.handle('download-spotify', async (event, url) => {
    return new Promise((resolve, reject) => {
        // BUG FIX: Tambahkan {artist} di nama file agar unik!
        const outputTemplate = path.join(__dirname, 'songs', '{artist} - {title}.{ext}');
        const command = `python -m spotdl download "${url}" --format mp3 --output "${outputTemplate}"`;

        exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Gagal spotdl: ${error.message}`);
                resolve({ success: false, error: error.message });
                return;
            }
            resolve({ success: true });
        });
    });
});

ipcMain.on("player-state", (_, playing) => {
    updateThumbar(playing);
});

ipcMain.on("show-notification", (_, song) => {

    showLiveCard(song);

});

ipcMain.on("live-prev", () => {
    if (win && !win.isDestroyed()) {
        safeSend(win, "thumb-prev");
    }
});

ipcMain.on("live-play", () => {
    if (win && !win.isDestroyed()) {
        safeSend(win, "thumb-play");
    }
});

ipcMain.on("live-next", () => {
    if (win && !win.isDestroyed()) {
        safeSend(win, "thumb-next");
    }
});

ipcMain.on("toggle-notification", (_, enabled) => {

    notificationEnabled = enabled;

});

ipcMain.on("toggle-tray", (_, enabled) => {
    isTrayEnabled = enabled;

    if (enabled) {
        if (!tray || tray.isDestroyed()) {
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
                            if (win && !win.isDestroyed()) {
                                win.show();
                            }
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
                if (win && !win.isDestroyed()) {
                    if (win.isMinimized()) {
                        win.restore();
                        win.focus();
                    } else if (win.isVisible()) {
                        win.hide();
                    } else {
                        win.show();
                        win.focus();
                    }
                }
            });
        }
    } else {
        if (tray && !tray.isDestroyed()) {
            tray.destroy();
            tray = null;
        }
    }
});

ipcMain.on("toggle-ontop", (_, enabled) => {
    isAlwaysOnTopSetting = enabled; // Simpan memori
    if (win && !win.isDestroyed()) {
        win.setAlwaysOnTop(enabled);
    }
});

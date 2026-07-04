const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage
} = require('electron');

const path = require('path');
const fs = require('fs');

let win;
let tray;
let isQuiting = false;

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

app.whenReady().then(() => {

    createWindow();
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
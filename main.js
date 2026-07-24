// Polyfill globalThis.File untuk undici / fetch di Electron Main Process
if (typeof globalThis.File === 'undefined') {
    const { Blob } = require('buffer');
    globalThis.File = class File extends Blob {
        constructor(fileBits, fileName, options = {}) {
            super(fileBits, options);
            this.name = fileName;
            this.lastModified = options.lastModified || Date.now();
        }
    };
}

const { app, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// 1. Dapatkan referensi state singleton
const state = require('./src/main/state');

// 2. Impor modul backend
const { createWindow, createNotificationWindow, updateThumbar } = require('./src/main/windowManager');
const { registerGlobalShortcuts, unregisterGlobalShortcuts } = require('./src/main/shortcuts');
const { registerDownloaderHandlers } = require('./src/main/downloader');
const { registerFileManagerHandlers } = require('./src/main/fileManager');
const { registerIpcListeners } = require('./src/main/ipcListeners');

// Tangani Unhandled promise rejections agar tidak crash diam-diam
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Single Instance Lock (Cegah membuka banyak jendela aplikasi)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (state.win) {
            if (state.win.isMinimized()) state.win.restore();
            state.win.show();
            state.win.focus();
        }
    });

    // Inisialisasi Aplikasi saat Ready
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

        // Inisialisasi Windows & Tray
        createWindow();
        createNotificationWindow();
        updateThumbar(false);

        // Daftarkan listener IPC & Shortcuts
        registerDownloaderHandlers();
        registerFileManagerHandlers();
        registerIpcListeners();
        registerGlobalShortcuts();

        // Validasi dependensi sistem (yt-dlp, spotdl, ffmpeg)
        checkSystemRequirements();
    });
}

// Logika Quit Aplikasi
app.on('before-quit', () => {
    state.isQuiting = true;
    if (state.miniWin && !state.miniWin.isDestroyed()) state.miniWin.destroy();
    if (state.notificationWin && !state.notificationWin.isDestroyed()) state.notificationWin.destroy();
    if (state.tray && !state.tray.isDestroyed()) {
        state.tray.destroy();
        state.tray = null;
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    unregisterGlobalShortcuts();
});

// Fungsi Validasi Sistem
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

    exec('ffmpeg -version', (error) => {
        if (error) {
            dialog.showMessageBox({
                type: 'warning',
                title: 'NJOY Warning - FFmpeg Tidak Ditemukan',
                message: 'Waduh! NJOY butuh "ffmpeg" untuk memproses audio & album art.\n\nSilakan instal FFmpeg dan pastikan sudah masuk ke PATH sistem Anda.',
            });
        }
    });
}

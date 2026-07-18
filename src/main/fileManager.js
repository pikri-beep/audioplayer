const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');

function registerFileManagerHandlers() {
    // 1. dialog ambil file musik
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

    // 2. parser metadata musik
    ipcMain.handle('get-metadata', async (event, filePath) => {
        try {
            const mm = await import('music-metadata');
            const metadata = await mm.parseFile(filePath);
            
            let coverPath = null;
            
            if (metadata.common.picture && metadata.common.picture.length > 0) {
                const picture = metadata.common.picture[0];
                const tempPath = path.join(app.getPath('temp'), 'current-cover.jpg');
                fs.writeFileSync(tempPath, picture.data);
                coverPath = tempPath;
            }
            
            return {
                title: metadata.common.title,
                artist: metadata.common.artist,
                coverPath: coverPath
            };
        } catch (error) {
            return null;
        }
    });

    // 3. custom cover upload
    ipcMain.handle('upload-custom-cover', async (event, songName) => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'gif'] }]
            });
            
            if (!result.canceled) {
                const sourcePath = result.filePaths[0];
                const destPath = path.join(__dirname, '../../covers', `${songName}-cover.jpg`);
                fs.copyFileSync(sourcePath, destPath);
                return destPath; 
            }
        } catch (err) {
            console.error("Gagal upload-custom-cover:", err.message);
        }
        return null;
    });

    // 4. hapus cover custom
    ipcMain.handle('remove-custom-cover', async (event, songName) => {
        try {
            const targetPath = path.join(__dirname, '../../covers', `${songName}-cover.jpg`);
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
                return true;
            }
        } catch (err) {
            console.error("Gagal remove-custom-cover:", err.message);
        }
        return false;
    });
}

module.exports = {
    registerFileManagerHandlers
};

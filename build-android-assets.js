const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = __dirname;
const wwwDir = path.join(__dirname, 'www');

console.log('🚀 [Build Android] Preparing www web bundle directory...');

if (fs.existsSync(wwwDir)) {
    fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Copy essential files and folders
const filesToCopy = ['index.html', 'style.css', 'renderer.js', 'playlists.json'];
const foldersToCopy = ['assets', 'covers', 'songs', 'src'];

filesToCopy.forEach(file => {
    const srcPath = path.join(srcDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(wwwDir, file));
        console.log(`  └─ Copied ${file}`);
    }
});

foldersToCopy.forEach(folder => {
    const srcPath = path.join(srcDir, folder);
    if (fs.existsSync(srcPath)) {
        copyRecursiveSync(srcPath, path.join(wwwDir, folder));
        console.log(`  └─ Copied directory ${folder}/`);
    }
});

console.log('✅ [Build Android] Web bundle ready in www/!');
console.log('🔄 [Capacitor Sync] Running npx cap sync android...');
try {
    execSync('npx cap sync android', { stdio: 'inherit', cwd: srcDir });
    console.log('🎉 [Success] Android Capacitor project synchronized successfully!');
} catch (e) {
    console.error('❌ Sync failed:', e.message);
}

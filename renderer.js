const fs = require('fs');
const { ipcRenderer } = require('electron');
const path = require('path');

const audio = document.getElementById('audio-element');
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const songTitleEl = document.getElementById('song-title');
const songArtistEl = document.getElementById('song-artist');
const playlistUl = document.getElementById('playlist-ul');
const { Vibrant } = require('node-vibrant/node');


const songsFolder = path.join(__dirname, 'songs');
let playlist = [];
let currentSongIndex = 0;
let isShuffle = false;
let isRepeat = false;

let njoyList = JSON.parse(localStorage.getItem('njoyList')) || [];
let currentMode = 'all'; 

// 1. Load Playlist dari folder songs
function loadPlaylist() {
    try {
        if (!fs.existsSync(songsFolder)) {
            fs.mkdirSync(songsFolder);
        }
        const files = fs.readdirSync(songsFolder);
        playlist = files.filter(file => file.endsWith('.mp3'));

        if (playlist.length > 0) {
            renderPlaylist();
            loadSong(currentSongIndex);
        } else {
            songTitleEl.innerText = "Playlist Kosong";
            songArtistEl.innerText = "Klik (+) untuk tambah mp3";
        }
    } catch (err) {
        console.error(err);
    }
}

// 2. Tampilkan daftar lagu di UI
function renderPlaylist() {
    if (!playlistUl) return;
    playlistUl.innerHTML = '';
    
    playlist.forEach((song, index) => {
        const isLiked = njoyList.includes(song);
        if (currentMode === 'njoy' && !isLiked) return;

        const li = document.createElement('li');
        if (index === currentSongIndex) li.classList.add('active');
        
        const span = document.createElement('span');
        span.innerText = song.replace('.mp3', '');
        span.style.flexGrow = '1';
        span.addEventListener('click', () => {
            currentSongIndex = index;
            loadSong(currentSongIndex);
            audio.play();
            playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        });

        const heartBtn = document.createElement('button');
        heartBtn.className = `heart-btn ${isLiked ? 'liked' : ''}`;
        heartBtn.innerHTML = isLiked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        heartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (njoyList.includes(song)) {
                njoyList = njoyList.filter(item => item !== song);
            } else {
                njoyList.push(song);
            }
            localStorage.setItem('njoyList', JSON.stringify(njoyList));
            renderPlaylist();
        });

        li.appendChild(span);
        li.appendChild(heartBtn);
        playlistUl.appendChild(li);
    });
}

// 3. Masukkan lagu ke elemen audio player
function loadSong(index) {
    if (playlist.length === 0) return;
    currentSongIndex = index;
    const songName = playlist[index];
    
    // Simpan letak file lagu di variabel baru
    const filePath = path.join(songsFolder, songName);
    
    audio.src = filePath;
    renderPlaylist();

    // Pisahkan nama file otomatis jadi Artis & Judul (jika ada tanda min '-')
    const cleanName = songName.replace('.mp3', '');
    if (cleanName.includes('-')) {
        const parts = cleanName.split('-');
        songArtistEl.innerText = parts[0].trim();
        songTitleEl.innerText = parts[1].trim();
    } else {
        songTitleEl.innerText = cleanName;
        songArtistEl.innerText = "Unknown Artist";
    }

    // +++ PANGGIL EKSTRAK METADATA DI SINI +++
    extractMetadata(filePath);

    // Cek apakah ada custom cover
    const customCover = path.join(__dirname, 'covers', 'custom-cover.jpg');
    if (fs.existsSync(customCover)) {
        document.getElementById('album-art-img').src = `file://${customCover}?t=${new Date().getTime()}`;
    } else {
        // Panggil fungsi metadata aslinya (extractMetadata)
        extractMetadata(audio.src);
    }
}

// LOGIKA KONTROL
function togglePlay() {
    if (playlist.length === 0) return;
    if (audio.paused) {
        audio.play();
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        audio.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

// Fungsi utama untuk mengatur transisi Fade Out dan Fade In
function changeSongWithFade(newIndex) {
    if (playlist.length === 0) return;
    
    // Ambil volume target saat ini (bisa saja user baru mengubah slider)
    if (volumeSlider) {
        targetVolume = volumeSlider.value / 100;
    }
    
    let currentVol = audio.volume;
    
    // Proses Fade Out
    let fadeOutInterval = setInterval(() => {
        if (currentVol > 0.05) {
            currentVol -= 0.05; 
            audio.volume = Math.max(0, currentVol);
        } else {
            clearInterval(fadeOutInterval);
            audio.pause();
            
            loadSong(newIndex);
            audio.volume = 0; 
            audio.play().catch(err => console.log("Play interrupted:", err));
            playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            
            // Proses Fade In
            let fadeInInterval = setInterval(() => {
                if (audio.volume < targetVolume - 0.05) {
                    audio.volume += 0.05; 
                } else {
                    audio.volume = targetVolume; // Kunci ke target volume asli
                    clearInterval(fadeInInterval);
                }
            }, 40); 
        }
    }, 30); 
}

// Update fungsi Next Song
function nextSong() {
    if (playlist.length === 0) return;
    let nextIndex = currentSongIndex;
    
    if (isRepeat) {
        nextIndex = currentSongIndex;
    } else if (isShuffle) {
        nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
        nextIndex = (currentSongIndex + 1) % playlist.length;
    }
    
    // Panggil fungsi transisi alih-alih ganti langsung
    changeSongWithFade(nextIndex); 
}

// Update fungsi Prev Song
function prevSong() {
    if (playlist.length === 0) return;
    let prevIndex = currentSongIndex;
    
    if (isRepeat) {
        prevIndex = currentSongIndex;
    } else if (isShuffle) {
        prevIndex = Math.floor(Math.random() * playlist.length);
    } else {
        prevIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    }
    
    // Panggil fungsi transisi alih-alih ganti langsung
    changeSongWithFade(prevIndex);
}

async function extractMetadata(filePath) {
    const albumArtImg = document.getElementById('album-art-img'); 
    
    try {
        const metadata = await ipcRenderer.invoke('get-metadata', filePath);
        
        if (metadata) {
            // 1. Atur teks judul, artis, dan notifikasi terlebih dahulu
            if (metadata.title) songTitleEl.innerText = metadata.title;
            if (metadata.artist) songArtistEl.innerText = metadata.artist;
            
            ipcRenderer.send("show-notification", {
                title: metadata.title || songTitleEl.innerText,
                artist: metadata.artist || songArtistEl.innerText,
                cover: metadata.coverPath || "covers/default.png" 
            });

            // 2. Atur gambar cover dan ekstrak warna dinamis
            if (metadata.coverPath) {
                // Update gambar di layar
                albumArtImg.src = `file://${metadata.coverPath}?t=${new Date().getTime()}`;
                
                // LANGSUNG tembak lokasi path file-nya, jangan pakai elemen 'albumArtImg'
                // Pakai .then() menyesuaikan versi node-vibrant 4+
                Vibrant.from(metadata.coverPath).getPalette()
                    .then((palette) => {
                        if (palette && palette.Vibrant) {
                            const rgb = palette.Vibrant.rgb;
                            const rgbString = `${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}`;
                            
                            document.documentElement.style.setProperty('--theme-glow', `rgb(${rgbString})`);
                            document.documentElement.style.setProperty('--theme-border', `rgba(${rgbString}, 0.3)`);
                        }
                    })
                    .catch((vibrantError) => {
                        console.log("Vibrant gagal ekstrak warna (tapi aplikasi tetap jalan):", vibrantError);
                    });

            } else {
                // Kalau lagu nggak ada cover, kembalikan gambar & warna ke default
                albumArtImg.src = "covers/default.png";
                document.documentElement.style.setProperty('--theme-glow', '#a855f7');
                document.documentElement.style.setProperty('--theme-border', 'rgba(168, 85, 247, 0.2)');
            }
        }
    } catch (error) {
        console.error("Gagal ambil metadata:", error);
        albumArtImg.src = "covers/default.png";
    }
}

playBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);
audio.addEventListener('ended', nextSong);

// Progress bar slider jalan
audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        progressBar.value = (audio.currentTime / audio.duration) * 100;
        let m = Math.floor(audio.currentTime / 60), s = Math.floor(audio.currentTime % 60);
        currentTimeEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
    }
});

audio.addEventListener('loadedmetadata', () => {
    let m = Math.floor(audio.duration / 60), s = Math.floor(audio.duration % 60);
    durationEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
});

progressBar.addEventListener('input', () => {
    audio.currentTime = (progressBar.value / 100) * audio.duration;
});

// Fitur Volume Slider & Memori Target Volume
let targetVolume = 0.7; // Default 70%
const volumeSlider = document.getElementById('volume-slider');

if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
        targetVolume = volumeSlider.value / 100;
        audio.volume = targetVolume;
        const volumeText = document.getElementById('volume-text');
        if (volumeText) volumeText.innerText = `${volumeSlider.value}%`;
    });
}

// Tombol Tambah Lagu (+)
document.getElementById('add-song-btn').addEventListener('click', async () => {
    const filePaths = await ipcRenderer.invoke('open-file-dialog');
    if (filePaths && filePaths.length > 0) {
        filePaths.forEach(filePath => {
            const fileName = path.basename(filePath);
            if (!fs.existsSync(path.join(songsFolder, fileName))) {
                fs.copyFileSync(filePath, path.join(songsFolder, fileName));
            }
        });
        loadPlaylist();
    }
});

// Navigasi Popup Playlist
const popup = document.getElementById('playlist-popup');
document.getElementById('playlist-toggle-btn').addEventListener('click', () => popup.classList.add('show'));
document.getElementById('close-popup-btn').addEventListener('click', () => popup.classList.remove('show'));

// Mode Semua / Queue
document.getElementById('btn-mode-all').addEventListener('click', () => {
    currentMode = 'all';
    document.getElementById('btn-mode-all').classList.add('active');
    document.getElementById('btn-mode-njoy').classList.remove('active');
    renderPlaylist();
});
document.getElementById('btn-mode-njoy').addEventListener('click', () => {
    currentMode = 'njoy';
    document.getElementById('btn-mode-njoy').classList.add('active');
    document.getElementById('btn-mode-all').classList.remove('active');
    renderPlaylist();
});

// Fitur Cari Musik
document.getElementById('search-bar').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const items = playlistUl.querySelectorAll('li');
    items.forEach(li => {
        li.style.display = li.innerText.toLowerCase().includes(keyword) ? 'flex' : 'none';
    });
});

// Toggle Shuffle
shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    // Ubah warna ikon biar ketahuan lagi aktif atau nggak
    shuffleBtn.style.color = isShuffle ? 'var(--theme-glow)' : '#aaa';
});

// Toggle Repeat
repeatBtn.addEventListener('click', () => {
    isRepeat = !isRepeat;
    // Ubah warna ikon biar ketahuan lagi aktif atau nggak
    repeatBtn.style.color = isRepeat ? 'var(--theme-glow)' : '#aaa';
});

//custom cover upload
document.getElementById('upload-cover-btn').addEventListener('click', async () => {
    const newCoverPath = await ipcRenderer.invoke('upload-custom-cover');
    if (newCoverPath) {
        // Langsung update UI
        document.getElementById('album-art-img').src = `file://${newCoverPath}?t=${new Date().getTime()}`;
    }
});

audio.addEventListener("play", () => {
    ipcRenderer.send("player-state", true);
});

audio.addEventListener("pause", () => {
    ipcRenderer.send("player-state", false);
});

ipcRenderer.on("thumb-play", () => {
    togglePlay();
});

ipcRenderer.on("thumb-next", () => {
    nextSong();
});

ipcRenderer.on("thumb-prev", () => {
    prevSong();
});

const SETTINGS_KEY = "njoy-settings";

let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
    tray: true,
    notification: true,
    alwaysOnTop: false
};

function saveSettings() {
    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );
}

const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");

const trayToggle = document.getElementById("tray-toggle");
const notificationToggle = document.getElementById("notification-toggle");
const alwaysOnTopToggle = document.getElementById("ontop-toggle");

settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.toggle("show");
});

// isi toggle sesuai setting
trayToggle.checked = settings.tray;
notificationToggle.checked = settings.notification;
alwaysOnTopToggle.checked = settings.alwaysOnTop;

trayToggle.addEventListener("change", () => {
    settings.tray = trayToggle.checked;
    saveSettings();
    // AKTIFKAN INI: Kirim status tray ke main process
    ipcRenderer.send("toggle-tray", settings.tray);
});

notificationToggle.addEventListener("change", () => {
    settings.notification = notificationToggle.checked;
    saveSettings();
    // AKTIFKAN INI: Kirim status notifikasi ke main process
    ipcRenderer.send("toggle-notification", settings.notification);
});

alwaysOnTopToggle.addEventListener("change", () => {
    settings.alwaysOnTop = alwaysOnTopToggle.checked;
    saveSettings();
    // AKTIFKAN & TAMBAHKAN INI: Kirim status always on top ke main process
    ipcRenderer.send("toggle-ontop", settings.alwaysOnTop);
});

ipcRenderer.send("toggle-ontop", settings.alwaysOnTop);
ipcRenderer.send("toggle-notification", settings.notification);
ipcRenderer.send("toggle-tray", settings.tray);

loadPlaylist();



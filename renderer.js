const fs = require('fs');
const { ipcRenderer } = require('electron');
const path = require('path');

const audio = document.getElementById('audio-element');
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const miniPlayerBtn = document.getElementById('mini-player-btn');
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
let unplayedShuffle = []; // Kantong memori untuk shuffle pintar

// Ambil data memori dengan aman (mencegah black screen)
let njoyList = [];
try {
    njoyList = JSON.parse(localStorage.getItem('njoyList')) || [];
} catch (error) {
    console.warn("Memori lokal rusak, mereset daftar NJOY...", error);
    njoyList = [];
}
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
            audio.play().catch(err => console.log(err));
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
    
    const filePath = path.join(songsFolder, songName);
    
    audio.src = filePath;
    renderPlaylist();

    const cleanName = songName.replace('.mp3', '');
    if (cleanName.includes('-')) {
        const parts = cleanName.split('-');
        songArtistEl.innerText = parts[0].trim();
        songTitleEl.innerText = parts[1].trim();
    } else {
        songTitleEl.innerText = cleanName;
        songArtistEl.innerText = "Unknown Artist";
    }

    // Panggil ekstrak metadata (Mencegah ganda)
    extractMetadata(filePath).then(() => {
        const specificCover = path.join(__dirname, 'covers', `${cleanName}-cover.jpg`);
        // Timpa dengan custom cover secara langsung jika ada
        if (fs.existsSync(specificCover)) {
            document.getElementById('album-art-img').src = `file://${specificCover}?t=${new Date().getTime()}`;
        }
        if (isMiniMode) syncToMiniPlayer();
    });
}

// LOGIKA KONTROL
function togglePlay() {
    if (playlist.length === 0) return;
    if (audio.paused) {
        // Cegah crash kalau dipencet brutal
        audio.play().catch(err => console.log("Play tertunda, memuat audio...", err));
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        audio.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

// Transisi Fade Out dan Fade In
function changeSongWithFade(newIndex) {
    if (playlist.length === 0) return;
    
    if (volumeSlider) {
        targetVolume = volumeSlider.value / 100;
    }
    
    let currentVol = audio.volume;
    
    let fadeOutInterval = setInterval(() => {
        if (currentVol > 0.05) {
            currentVol -= 0.05; 
            audio.volume = Math.max(0, currentVol);
        } else {
            clearInterval(fadeOutInterval);
            audio.pause();
            
            loadSong(newIndex);
            
            if (isMuted) {
                audio.volume = 0; // Kunci di 0, jangan jalankan Fade In
                audio.play().catch(err => console.log(err));
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                audio.volume = 0; 
                audio.play().catch(err => console.log(err));
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                
                let fadeInInterval = setInterval(() => {
                    if (audio.volume < targetVolume - 0.05) {
                        audio.volume += 0.05; 
                    } else {
                        audio.volume = targetVolume; 
                        clearInterval(fadeInInterval);
                    }
                }, 40); 
            }
        }
    }, 30); 
}

// Shuffle Pintar dan Next Song
function nextSong() {
    if (playlist.length === 0) return;
    let nextIndex = currentSongIndex;
    
    if (isRepeat) {
        nextIndex = currentSongIndex;
    } else if (isShuffle) {
        if (unplayedShuffle.length === 0) {
            for (let i = 0; i < playlist.length; i++) {
                if (i !== currentSongIndex) unplayedShuffle.push(i);
            }
        }
        const randomBagIndex = Math.floor(Math.random() * unplayedShuffle.length);
        nextIndex = unplayedShuffle[randomBagIndex];
        unplayedShuffle.splice(randomBagIndex, 1);
    } else {
        nextIndex = (currentSongIndex + 1) % playlist.length;
    }
    
    changeSongWithFade(nextIndex); 
}

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
    
    changeSongWithFade(prevIndex);
}

async function extractMetadata(filePath) {
    const albumArtImg = document.getElementById('album-art-img');
    try {
        const metadata = await ipcRenderer.invoke('get-metadata', filePath);
        
        if (metadata) {
            if (metadata.title) songTitleEl.innerText = metadata.title;
            if (metadata.artist) songArtistEl.innerText = metadata.artist;
            
            ipcRenderer.send("show-notification", {
                title: metadata.title || songTitleEl.innerText,
                artist: metadata.artist || songArtistEl.innerText,
                cover: metadata.coverPath || "covers/default.png" 
            });

            if (metadata.coverPath) {
                albumArtImg.src = `file://${metadata.coverPath}?t=${new Date().getTime()}`;
                
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
                        console.log("Vibrant error:", vibrantError);
                    });

            } else {
                albumArtImg.src = "file://" + path.join(__dirname, "covers", "default.png");
                document.documentElement.style.setProperty('--theme-glow', '#a855f7');
                document.documentElement.style.setProperty('--theme-border', 'rgba(168, 85, 247, 0.2)');
            }
        }
    } catch (error) {
        console.error("Gagal ambil metadata:", error);
        albumArtImg.src = "file://" + path.join(__dirname, "covers", "default.png");
    }
}

playBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);
audio.addEventListener('ended', nextSong);

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

// Fitur Volume & Mute
let targetVolume = 0.7; 
let lastVolume = 0.7; 
let isMuted = false;

const volumeSlider = document.getElementById('volume-slider');
const volumeText = document.getElementById('volume-text');
const volumeIcon = document.getElementById('volume-icon');

function updateVolumeIcon(vol) {
    if (!volumeIcon) return;
    if (vol === 0 || isMuted) {
        volumeIcon.className = 'fa-solid fa-volume-xmark'; 
    } else if (vol < 0.5) {
        volumeIcon.className = 'fa-solid fa-volume-low'; 
    } else {
        volumeIcon.className = 'fa-solid fa-volume-high'; 
    }
}

function toggleMute() {
    if (isMuted) {
        isMuted = false;
        audio.volume = lastVolume > 0 ? lastVolume : 0.7; 
        if (volumeSlider) volumeSlider.value = audio.volume * 100;
    } else {
        lastVolume = audio.volume;
        isMuted = true;
        audio.volume = 0;
        if (volumeSlider) volumeSlider.value = 0;
    }
    
    if (volumeText) volumeText.innerText = `${Math.round(audio.volume * 100)}%`;
    updateVolumeIcon(audio.volume);
}

if (volumeIcon) volumeIcon.addEventListener('click', toggleMute);

if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
        targetVolume = volumeSlider.value / 100;
        audio.volume = targetVolume;
        isMuted = targetVolume === 0; 
        
        if (volumeText) volumeText.innerText = `${volumeSlider.value}%`;
        updateVolumeIcon(targetVolume);
    });
}

ipcRenderer.on('shortcut-mute', toggleMute);

// ==========================================
// LOGIKA DROPDOWN MENU TAMBAH LAGU
// ==========================================
const addMenuBtn = document.getElementById('add-menu-btn');
const addDropdown = document.getElementById('add-dropdown');
const importFileBtn = document.getElementById('import-file-btn');
const importYtBtn = document.getElementById('import-yt-btn');

// Buka/Tutup dropdown saat ikon (+) diklik
addMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Mencegah event tumpah ruah
    addDropdown.classList.toggle('show');
});

// Tutup dropdown otomatis kalau kita ngeklik area kosong di layar
document.addEventListener('click', () => {
    if (addDropdown.classList.contains('show')) {
        addDropdown.classList.remove('show');
    }
});

// 1. Tombol Tambah File Lokal
importFileBtn.addEventListener('click', async () => {
    addDropdown.classList.remove('show'); // Tutup menu
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

// 2. Tombol Import YouTube
importYtBtn.addEventListener('click', () => {
    addDropdown.classList.remove('show'); // Tutup menu
    const ytPopup = document.getElementById('yt-popup');
    if(ytPopup) ytPopup.classList.add('show');
});

const popup = document.getElementById('playlist-popup');
document.getElementById('playlist-toggle-btn').addEventListener('click', () => popup.classList.add('show'));
document.getElementById('close-popup-btn').addEventListener('click', () => popup.classList.remove('show'));

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

shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.style.color = isShuffle ? 'var(--theme-glow)' : '#aaa';
});

repeatBtn.addEventListener('click', () => {
    isRepeat = !isRepeat;
    repeatBtn.style.color = isRepeat ? 'var(--theme-glow)' : '#aaa';
});

// LOGIKA MINI PLAYER
let isMiniMode = false;
if (miniPlayerBtn) {
    miniPlayerBtn.addEventListener('click', () => {
        isMiniMode = !isMiniMode;
        ipcRenderer.send('toggle-mini-player', isMiniMode);
    });
}

// Kembalikan status tombol kalau di-expand dari widget
ipcRenderer.on('set-mini-mode', (_, isMini) => {
    isMiniMode = isMini;
});

// Fungsi untuk mensinkronkan data lagu dengan widget
function syncToMiniPlayer() {
    ipcRenderer.send('sync-mini-player', {
        title: songTitleEl.innerText,
        artist: songArtistEl.innerText,
        cover: document.getElementById('album-art-img').src,
        isPlaying: !audio.paused,
        theme: document.body.getAttribute('data-theme') || 'default'
    });
}

// Kirim data saat diminta oleh widget pertama kali
ipcRenderer.on('request-state-for-mini', syncToMiniPlayer);

// Custom cover
const uploadCoverBtn = document.getElementById('upload-cover-btn');
uploadCoverBtn.addEventListener('click', async () => {
    if (playlist.length === 0) return;
    const currentSongName = playlist[currentSongIndex].replace('.mp3', '');
    const newCoverPath = await ipcRenderer.invoke('upload-custom-cover', currentSongName);
    if (newCoverPath) {
        document.getElementById('album-art-img').src = `file://${newCoverPath}?t=${new Date().getTime()}`;
    }
});

uploadCoverBtn.addEventListener('contextmenu', async (e) => {
    e.preventDefault(); 
    if (playlist.length === 0) return;
    const currentSongName = playlist[currentSongIndex].replace('.mp3', '');
    const isRemoved = await ipcRenderer.invoke('remove-custom-cover', currentSongName);
    if (isRemoved) {
        const filePath = path.join(songsFolder, playlist[currentSongIndex]);
        extractMetadata(filePath);
    }
});

audio.addEventListener("play", () => {
    ipcRenderer.send("player-state", true);
    syncToMiniPlayer();
});
audio.addEventListener("pause", () => {
    ipcRenderer.send("player-state", false);
    syncToMiniPlayer();
});

ipcRenderer.on("thumb-play", () => togglePlay());
ipcRenderer.on("thumb-next", () => nextSong());
ipcRenderer.on("thumb-prev", () => prevSong());

const SETTINGS_KEY = "njoy-settings";
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
    tray: true,
    notification: true,
    alwaysOnTop: false
};

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const trayToggle = document.getElementById("tray-toggle");
const notificationToggle = document.getElementById("notification-toggle");
const alwaysOnTopToggle = document.getElementById("ontop-toggle");

settingsBtn.addEventListener("click", () => settingsPanel.classList.toggle("show"));

trayToggle.checked = settings.tray;
notificationToggle.checked = settings.notification;
alwaysOnTopToggle.checked = settings.alwaysOnTop;

trayToggle.addEventListener("change", () => {
    settings.tray = trayToggle.checked;
    saveSettings();
    ipcRenderer.send("toggle-tray", settings.tray);
});

notificationToggle.addEventListener("change", () => {
    settings.notification = notificationToggle.checked;
    saveSettings();
    ipcRenderer.send("toggle-notification", settings.notification);
});

alwaysOnTopToggle.addEventListener("change", () => {
    settings.alwaysOnTop = alwaysOnTopToggle.checked;
    saveSettings();
    ipcRenderer.send("toggle-ontop", settings.alwaysOnTop);
});

ipcRenderer.send("toggle-ontop", settings.alwaysOnTop);
ipcRenderer.send("toggle-notification", settings.notification);
ipcRenderer.send("toggle-tray", settings.tray);

const themeSelector = document.getElementById('theme-selector');
const savedTheme = localStorage.getItem('njoy_theme') || 'default';

document.body.setAttribute('data-theme', savedTheme);
if (themeSelector) themeSelector.value = savedTheme;

if (themeSelector) {
    themeSelector.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        document.body.setAttribute('data-theme', selectedTheme);
        localStorage.setItem('njoy_theme', selectedTheme);
        syncToMiniPlayer();
    });
}

const searchBar = document.getElementById('search-bar');
if (searchBar && playlistUl) {
    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const songItems = playlistUl.getElementsByTagName('li');
        
        Array.from(songItems).forEach(item => {
            const songName = item.textContent.toLowerCase();
            item.style.display = songName.includes(searchTerm) ? 'flex' : 'none'; 
        });
    });
}

/* =================================================================
   UI YOUTUBE SEARCH & DOWNLOADER
================================================================= */
const ytPopup = document.getElementById('yt-popup');
const closeYtBtn = document.getElementById('close-yt-btn');
const startYtDlBtn = document.getElementById('start-yt-dl-btn');
const ytStatusText = document.getElementById('yt-status-text');
const ytUrlInput = document.getElementById('yt-url-input');
const ytSearchResults = document.getElementById('yt-search-results');

closeYtBtn.addEventListener('click', () => {
    ytPopup.classList.remove('show');
    ytStatusText.style.display = 'none';
    ytSearchResults.innerHTML = '';
    ytUrlInput.value = '';
});

// 1. PROSES MENCARI LAGU
startYtDlBtn.addEventListener('click', async () => {
    const query = ytUrlInput.value.trim();
    if (!query) { alert("Ketik judul lagunya dulu bang!"); return; }

    ytSearchResults.innerHTML = '';
    ytStatusText.style.display = 'block';
    ytStatusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Mencari di YouTube...';

    // Minta main.js untuk mencari
    const results = await ipcRenderer.invoke('search-yt', query);
    
    ytStatusText.style.display = 'none';

    if (results.length === 0) {
        ytStatusText.style.display = 'block';
        ytStatusText.innerHTML = 'Lagu tidak ditemukan!';
        return;
    }

    // 2. TAMPILKAN HASILNYA SEBAGAI DAFTAR KLIK
    results.forEach(video => {
        const li = document.createElement('li');
        // Desain Kartu List Lagu (Bisa ikut menyesuaikan tema)
        li.style.cssText = `display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: 0.2s;`;
        
        li.innerHTML = `
            <img src="${video.thumbnail}" style="width: 60px; height: 45px; object-fit: cover; border-radius: 5px;">
            <div style="flex: 1; overflow: hidden;">
                <div style="font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${video.title}</div>
                <div style="font-size: 10px; color: #aaa;">${video.author} • ${video.timestamp}</div>
            </div>
            <i class="fa-solid fa-download" style="color: #aaa; margin-right: 5px;"></i>
        `;

        // Efek Hover pakai event listener JS biar simple
        li.addEventListener('mouseenter', () => li.style.background = 'rgba(255,255,255,0.1)');
        li.addEventListener('mouseleave', () => li.style.background = 'rgba(255,255,255,0.05)');

        // 3. JIKA SALAH SATU LAGU DIKLIK -> DOWNLOAD!
        li.addEventListener('click', async () => {
            ytSearchResults.innerHTML = ''; // Kosongkan daftar
            ytStatusText.style.display = 'block';
            ytStatusText.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Mendownload <b>${video.title}</b>... (Tunggu ya!)`;

            // Mulai Download lewat main.js
            const result = await ipcRenderer.invoke('download-yt', video.url);

            if (result.success) {
                ytStatusText.innerHTML = '<i class="fa-solid fa-check" style="color: #00ff00;"></i> Berhasil! Dimasukkan ke playlist...';
                setTimeout(() => {
                    ytPopup.classList.remove('show');
                    ytStatusText.style.display = 'none';
                    ytUrlInput.value = '';
                    loadPlaylist(); // Refresh NJOY!
                }, 2000);
            } else {
                ytStatusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: red;"></i> Gagal! Cek koneksi atau yt-dlp.';
            }
        });

        ytSearchResults.appendChild(li);
    });
});

loadPlaylist();
window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Renderer Unhandled Rejection]', event.reason);
});

const fs = require('fs');
const { ipcRenderer } = require('electron');
const path = require('path');
const { Vibrant } = require('node-vibrant/node');

// 1. KUMPULAN VARIABEL DOM
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
const addMenuBtn = document.getElementById('add-menu-btn');
const addDropdown = document.getElementById('add-dropdown');
const importFileBtn = document.getElementById('import-file-btn');
const importYtBtn = document.getElementById('import-yt-btn');
const volumeSlider = document.getElementById('volume-slider');
const volumeText = document.getElementById('volume-text');
const volumeIcon = document.getElementById('volume-icon');

// UI YOUTUBE
const ytPopup = document.getElementById('yt-popup');
const closeYtBtn = document.getElementById('close-yt-btn');
const startYtDlBtn = document.getElementById('start-yt-dl-btn');
const ytStatusText = document.getElementById('yt-status-text');
const ytUrlInput = document.getElementById('yt-url-input');
const ytSearchResults = document.getElementById('yt-search-results');
const ytDownloadBtn = document.getElementById('yt-download-btn'); 

// UI LIRIK
const lyricsPopup = document.getElementById('lyrics-popup');
const closeLyricsBtn = document.getElementById('close-lyrics-btn');
const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
const lyricsContainer = document.getElementById('lyrics-content');

const songsFolder = path.join(__dirname, 'songs');
let playlist = [];
let currentSongIndex = 0;
let isShuffle = false;
let isRepeat = false;
let isMiniMode = false;
let unplayedShuffle = [];
let njoyList = JSON.parse(localStorage.getItem('njoyList')) || [];
let currentMode = 'all';

let currentLyrics = [];
let currentLyricIndex = -1;
let targetVolume = 0.7; 
let lastVolume = 0.7; 
let isMuted = false;
audio.volume = targetVolume; // Set volume awal agar sinkron dengan UI slider

let fadeOutInterval = null;
let fadeInInterval = null;
let lyricsFetchCount = 0;

// 2. FUNGSI LOAD & RENDER PLAYLIST
function resetDefaultThemeColors() {
    document.documentElement.style.setProperty('--theme-glow', '#a855f7');
    document.documentElement.style.setProperty('--theme-border', 'rgba(168, 85, 247, 0.2)');
}

function loadPlaylist(isInitial = false) {
    try {
        if (!fs.existsSync(songsFolder)) fs.mkdirSync(songsFolder);
        const oldSongName = playlist[currentSongIndex];
        playlist = fs.readdirSync(songsFolder).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp3', '.wav', '.m4a', '.ogg'].includes(ext);
        });
        unplayedShuffle = [];
        
        if (playlist.length > 0) {
            if (oldSongName) {
                const newIndex = playlist.indexOf(oldSongName);
                if (newIndex !== -1) {
                    currentSongIndex = newIndex;
                } else {
                    currentSongIndex = 0;
                }
            } else {
                currentSongIndex = 0;
            }
            renderPlaylist();
            
            // Hanya panggil loadSong jika ini adalah inisialisasi awal ATAU belum ada audio yang dimuat
            if (isInitial || !audio.src || audio.src === '' || audio.src.endsWith('/undefined') || audio.src.endsWith('\\undefined')) {
                loadSong(currentSongIndex);
            }
        } else {
            songTitleEl.innerText = "Playlist Kosong";
            songArtistEl.innerText = "Klik (+) untuk tambah mp3";
            audio.src = '';
            const albumArtImg = document.getElementById('album-art-img');
            if (albumArtImg) albumArtImg.src = "file://" + path.join(__dirname, "covers", "default.png");
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    } catch (err) { console.error(err); }
}

function renderPlaylist() {
    if (!playlistUl) return;
    playlistUl.innerHTML = '';
    playlist.forEach((song, index) => {
        const isLiked = njoyList.includes(song);
        if (currentMode === 'njoy' && !isLiked) return;
        
        const li = document.createElement('li');
        if (index === currentSongIndex) li.classList.add('active');
        
        const span = document.createElement('span');
        span.innerText = path.parse(song).name;
        span.style.flexGrow = '1';
        span.addEventListener('click', () => { 
            currentSongIndex = index; 
            changeSongWithFade(currentSongIndex);
        });
        
        const heartBtn = document.createElement('button');
        heartBtn.className = `heart-btn ${isLiked ? 'liked' : ''}`;
        heartBtn.innerHTML = isLiked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        heartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (njoyList.includes(song)) njoyList = njoyList.filter(item => item !== song);
            else njoyList.push(song);
            localStorage.setItem('njoyList', JSON.stringify(njoyList));
            renderPlaylist();
        });

        li.appendChild(span);
        li.appendChild(heartBtn);
        playlistUl.appendChild(li);
    });
}

function loadSong(index) {
    if (playlist.length === 0) return;
    if (index < 0 || index >= playlist.length) {
        index = 0;
    }
    currentSongIndex = index;
    const songName = playlist[index];
    const filePath = path.join(songsFolder, songName);
    audio.src = filePath;
    renderPlaylist();
    
    const cleanName = path.parse(songName).name;
    if (cleanName.includes('-')) {
        const parts = cleanName.split('-');
        songArtistEl.innerText = parts[0].trim();
        songTitleEl.innerText = parts.slice(1).join('-').trim();
    } else {
        songTitleEl.innerText = cleanName;
        songArtistEl.innerText = "Unknown Artist";
    }

    extractMetadata(filePath, cleanName);
}

// 3. FUNGSI EKSTRAK METADATA & FETCH LIRIK (BUG FIX)
async function extractMetadata(filePath, cleanName) {
    const albumArtImg = document.getElementById('album-art-img');
    const specificCover = path.join(__dirname, 'covers', `${cleanName}-cover.jpg`);
    const hasCustomCover = fs.existsSync(specificCover);
    
    let finalTitle = songTitleEl.innerText;
    let finalArtist = songArtistEl.innerText;

    try {
        const metadata = await ipcRenderer.invoke('get-metadata', filePath);
        
        if (metadata) {
            if (metadata.title) { finalTitle = metadata.title; songTitleEl.innerText = finalTitle; }
            if (metadata.artist) { finalArtist = metadata.artist; songArtistEl.innerText = finalArtist; }
        }

        // --- FETCH LIRIK SETELAH DAPAT JUDUL ASLI DARI METADATA ---
        fetchLyrics(finalArtist, finalTitle);

        let finalCoverPath = hasCustomCover ? specificCover : (metadata && metadata.coverPath ? metadata.coverPath : null);
        albumArtImg.src = finalCoverPath ? `file://${finalCoverPath}?t=${new Date().getTime()}` : "file://" + path.join(__dirname, "covers", "default.png");
        
        ipcRenderer.send("show-notification", {
            title: finalTitle,
            artist: finalArtist,
            cover: finalCoverPath || "covers/default.png"
        });

        if (finalCoverPath) {
            Vibrant.from(finalCoverPath).getPalette().then((palette) => {
                if (palette && palette.Vibrant) {
                    const rgb = palette.Vibrant.rgb;
                    const rgbString = `${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}`;
                    document.documentElement.style.setProperty('--theme-glow', `rgb(${rgbString})`);
                    document.documentElement.style.setProperty('--theme-border', `rgba(${rgbString}, 0.3)`);
                } else {
                    resetDefaultThemeColors();
                }
                if (isMiniMode) syncToMiniPlayer();
            }).catch(() => {
                resetDefaultThemeColors();
                if (isMiniMode) syncToMiniPlayer();
            });
        } else {
            resetDefaultThemeColors();
            if (isMiniMode) syncToMiniPlayer();
        }

    } catch (error) {
        albumArtImg.src = "file://" + path.join(__dirname, "covers", "default.png");
        resetDefaultThemeColors();
        fetchLyrics(finalArtist, finalTitle); // Tetap coba fetch lirik meski metadata gagal
        if (isMiniMode) syncToMiniPlayer();
    }
}

// 4. KONTROL AUDIO (PLAY, NEXT, PREV, FADE)
function syncToMiniPlayer() {
    ipcRenderer.send('sync-mini-player', {
        title: songTitleEl.innerText,
        artist: songArtistEl.innerText,
        cover: document.getElementById('album-art-img').src,
        isPlaying: !audio.paused,
        theme: document.body.getAttribute('data-theme') || 'default',
        themeGlow: getComputedStyle(document.documentElement).getPropertyValue('--theme-glow').trim(),
        themeBorder: getComputedStyle(document.documentElement).getPropertyValue('--theme-border').trim()
    });
}

function togglePlay() {
    if (playlist.length === 0) return;
    if (audio.paused) {
        audio.play().catch(err => console.log(err));
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        audio.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

function changeSongWithFade(newIndex) {
    if (playlist.length === 0) return;
    
    // Clear any existing fade intervals to prevent overlap/glitches
    if (fadeOutInterval) clearInterval(fadeOutInterval);
    if (fadeInInterval) clearInterval(fadeInInterval);
    
    if (volumeSlider) targetVolume = volumeSlider.value / 100;
    
    let currentVol = audio.volume;
    fadeOutInterval = setInterval(() => {
        if (currentVol > 0.05) {
            currentVol -= 0.05; 
            audio.volume = Math.max(0, currentVol);
        } else {
            clearInterval(fadeOutInterval);
            fadeOutInterval = null;
            audio.pause();
            loadSong(newIndex);
            
            if (isMuted) {
                audio.volume = 0;
                audio.play().catch(e => console.log(e));
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                audio.volume = 0; 
                audio.play().catch(e => console.log(e));
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                fadeInInterval = setInterval(() => {
                    if (audio.volume < targetVolume - 0.05) {
                        audio.volume += 0.05; 
                    } else {
                        audio.volume = targetVolume;
                        clearInterval(fadeInInterval);
                        fadeInInterval = null;
                    }
                }, 40); 
            }
        }
    }, 30); 
}

function nextSong(isAutomatic = false) {
    const auto = isAutomatic === true;
    if (playlist.length === 0) return;
    let nextIndex = currentSongIndex;
    if (auto && isRepeat) nextIndex = currentSongIndex;
    else if (isShuffle) {
        if (unplayedShuffle.length === 0) {
            for (let i = 0; i < playlist.length; i++) {
                if (i !== currentSongIndex) {
                    if (currentMode !== 'njoy' || njoyList.includes(playlist[i])) {
                        unplayedShuffle.push(i);
                    }
                }
            }
        }
        if (unplayedShuffle.length > 0) {
            const randomBagIndex = Math.floor(Math.random() * unplayedShuffle.length);
            nextIndex = unplayedShuffle[randomBagIndex];
            unplayedShuffle.splice(randomBagIndex, 1);
        } else {
            nextIndex = currentSongIndex;
        }
    } else {
        if (currentMode === 'njoy') {
            let found = false;
            for (let i = 1; i <= playlist.length; i++) {
                let idx = (currentSongIndex + i) % playlist.length;
                if (njoyList.includes(playlist[idx])) {
                    nextIndex = idx;
                    found = true;
                    break;
                }
            }
            if (!found) nextIndex = currentSongIndex;
        } else {
            nextIndex = (currentSongIndex + 1) % playlist.length;
        }
    }
    changeSongWithFade(nextIndex); 
}

function prevSong(isAutomatic = false) {
    const auto = isAutomatic === true;
    if (playlist.length === 0) return;
    let prevIndex = currentSongIndex;
    if (auto && isRepeat) prevIndex = currentSongIndex;
    else if (isShuffle) {
        if (currentMode === 'njoy') {
            const likedIndices = [];
            playlist.forEach((song, idx) => {
                if (njoyList.includes(song)) likedIndices.push(idx);
            });
            if (likedIndices.length > 0) {
                prevIndex = likedIndices[Math.floor(Math.random() * likedIndices.length)];
            }
        } else {
            prevIndex = Math.floor(Math.random() * playlist.length);
        }
    } else {
        if (currentMode === 'njoy') {
            let found = false;
            for (let i = 1; i <= playlist.length; i++) {
                let idx = (currentSongIndex - i + playlist.length) % playlist.length;
                if (njoyList.includes(playlist[idx])) {
                    prevIndex = idx;
                    found = true;
                    break;
                }
            }
            if (!found) prevIndex = currentSongIndex;
        } else {
            prevIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
        }
    }
    changeSongWithFade(prevIndex);
}

playBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);
audio.addEventListener('ended', () => nextSong(true));

audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        progressBar.value = (audio.currentTime / audio.duration) * 100;
        let m = Math.floor(audio.currentTime / 60), s = Math.floor(audio.currentTime % 60);
        currentTimeEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
    }

    // --- LIRIK KARAOKE ---
    if (currentLyrics.length > 0) {
        let activeIndex = -1;
        for (let i = 0; i < currentLyrics.length; i++) {
            if (audio.currentTime >= currentLyrics[i].time) activeIndex = i;
            else break;
        }
        
        if (activeIndex !== -1 && activeIndex !== currentLyricIndex) {
            if (currentLyricIndex !== -1) {
                const oldEl = document.getElementById(`lyric-${currentLyricIndex}`);
                if (oldEl) oldEl.classList.remove('active');
            }
            const newEl = document.getElementById(`lyric-${activeIndex}`);
            if (newEl) {
                newEl.classList.add('active');
                newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            currentLyricIndex = activeIndex;
        }
    }
});

audio.addEventListener('loadedmetadata', () => {
    let m = Math.floor(audio.duration / 60), s = Math.floor(audio.duration % 60);
    durationEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
});

progressBar.addEventListener('input', () => { audio.currentTime = (progressBar.value / 100) * audio.duration; });

// 5. FITUR VOLUME & SHUFFLE & REPEAT (DIKEMBALIKAN!)
function updateVolumeIcon(vol) {
    if (!volumeIcon) return;
    if (vol === 0 || isMuted) volumeIcon.className = 'fa-solid fa-volume-xmark'; 
    else if (vol < 0.5) volumeIcon.className = 'fa-solid fa-volume-low'; 
    else volumeIcon.className = 'fa-solid fa-volume-high'; 
}

function adjustVolume(change) {
    let newVol = Math.min(1, Math.max(0, audio.volume + change));
    newVol = Math.round(newVol * 100) / 100;
    audio.volume = newVol;
    targetVolume = newVol;
    isMuted = newVol === 0;
    if (volumeSlider) volumeSlider.value = Math.round(newVol * 100);
    if (volumeText) volumeText.innerText = `${Math.round(newVol * 100)}%`;
    updateVolumeIcon(newVol);
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
ipcRenderer.on('shortcut-volume-up', () => adjustVolume(0.05));
ipcRenderer.on('shortcut-volume-down', () => adjustVolume(-0.05));

shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.style.color = isShuffle ? 'var(--theme-glow)' : '#aaa';
});

repeatBtn.addEventListener('click', () => {
    isRepeat = !isRepeat;
    repeatBtn.style.color = isRepeat ? 'var(--theme-glow)' : '#aaa';
});

// 6. MESIN PENCARI LIRIK
function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const lyrics = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for (let line of lines) {
        const match = timeRegex.exec(line);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = parseInt(match[3], 10) * (match[3].length === 2 ? 10 : 1);
            const time = minutes * 60 + seconds + milliseconds / 1000;
            const text = line.replace(timeRegex, '').trim();
            if (text) lyrics.push({ time, text });
        }
    }
    return lyrics;
}

async function fetchLyrics(artist, title) {
    if (!lyricsContainer) return;
    lyricsFetchCount++;
    const thisFetchId = lyricsFetchCount;

    lyricsContainer.innerHTML = '<p class="lyric-placeholder" style="color: #aaa; margin-top: 50px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Mencari lirik...</p>';
    currentLyrics = [];
    currentLyricIndex = -1;
    
    try {
        const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
        let query = cleanTitle;
        if (artist && artist !== "Unknown Artist") {
            query = artist + ' ' + cleanTitle;
        }
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (thisFetchId !== lyricsFetchCount) return; // Abort if another fetch has started
        
        if (data && data.length > 0) {
            const synced = data.find(track => track.syncedLyrics);
            if (synced) {
                currentLyrics = parseLRC(synced.syncedLyrics);
                lyricsContainer.innerHTML = '';
                currentLyrics.forEach((line, index) => {
                    const p = document.createElement('p');
                    p.className = 'lyric-line';
                    p.id = `lyric-${index}`;
                    p.innerText = line.text;
                    p.addEventListener('click', () => { audio.currentTime = line.time; });
                    lyricsContainer.appendChild(p);
                });
                return;
            }
        }
        lyricsContainer.innerHTML = '<p class="lyric-placeholder" style="color: #aaa; margin-top: 50px;">Lirik karaoke tidak ditemukan 🥲</p>';
    } catch (err) {
        if (thisFetchId !== lyricsFetchCount) return;
        lyricsContainer.innerHTML = '<p class="lyric-placeholder" style="color: red; margin-top: 50px;">Gagal memuat lirik (Cek koneksi).</p>';
    }
}

if (lyricsToggleBtn) lyricsToggleBtn.addEventListener('click', () => lyricsPopup.classList.add('show'));
if (closeLyricsBtn) closeLyricsBtn.addEventListener('click', () => lyricsPopup.classList.remove('show'));

// 7. UI POPUP PLAYLIST & SETTINGS (DIKEMBALIKAN!)
const popup = document.getElementById('playlist-popup');
document.getElementById('playlist-toggle-btn').addEventListener('click', () => popup.classList.add('show'));
document.getElementById('close-popup-btn').addEventListener('click', () => popup.classList.remove('show'));

document.getElementById('btn-mode-all').addEventListener('click', () => {
    currentMode = 'all';
    unplayedShuffle = [];
    document.getElementById('btn-mode-all').classList.add('active');
    document.getElementById('btn-mode-njoy').classList.remove('active');
    renderPlaylist();
});
document.getElementById('btn-mode-njoy').addEventListener('click', () => {
    currentMode = 'njoy';
    unplayedShuffle = [];
    document.getElementById('btn-mode-njoy').classList.add('active');
    document.getElementById('btn-mode-all').classList.remove('active');
    renderPlaylist();
});

const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
if(settingsBtn) settingsBtn.addEventListener("click", () => settingsPanel.classList.toggle("show"));

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

const themeSelector = document.getElementById('theme-selector');
if (themeSelector) {
    const savedTheme = localStorage.getItem('njoy_theme') || 'default';
    themeSelector.value = savedTheme;
    document.body.setAttribute('data-theme', savedTheme);

    themeSelector.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        document.body.setAttribute('data-theme', selectedTheme);
        localStorage.setItem('njoy_theme', selectedTheme);
        syncToMiniPlayer();
    });
}

// 8. LOGIKA SMART INPUT (YOUTUBE, SPOTIFY, & SEARCH)
if (ytDownloadBtn) ytDownloadBtn.addEventListener('click', () => { ytPopup.classList.add('show'); });
closeYtBtn.addEventListener('click', () => { ytPopup.classList.remove('show'); ytSearchResults.innerHTML = ''; ytStatusText.style.display = 'none'; });

function handleDownloadResult(result) {
    if (result.success) {
        ytStatusText.innerHTML = '<i class="fa-solid fa-check" style="color: #00ff00;"></i> Berhasil! Menambahkan ke playlist...';
        setTimeout(() => {
            ytPopup.classList.remove('show');
            ytStatusText.style.display = 'none';
            ytUrlInput.value = '';
            loadPlaylist();
        }, 2000);
    } else {
        ytStatusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: red;"></i> Gagal! Cek koneksi internet/terminal.';
    }
}

startYtDlBtn.addEventListener('click', async () => {
    const query = ytUrlInput.value.trim();
    if (!query) return alert("Ketik judul lagu atau paste link bang!");

    ytSearchResults.innerHTML = '';
    ytStatusText.style.display = 'block';

    const isSpotify = /open\.spotify\.com/i.test(query);
    const isYouTube = /(youtube\.com|youtu\.be)/i.test(query);

    if (isSpotify) {
        ytStatusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Mengekstraksi dari Spotify...';
        const result = await ipcRenderer.invoke('download-spotify', query);
        handleDownloadResult(result);
    } else if (isYouTube) {
        ytStatusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Mendownload dari YouTube...';
        const result = await ipcRenderer.invoke('download-yt', query);
        handleDownloadResult(result);
    } else {
        ytStatusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Mencari...';
        const results = await ipcRenderer.invoke('search-yt', query);
        ytStatusText.style.display = 'none';

        if (results.length === 0) {
            ytStatusText.style.display = 'block';
            ytStatusText.innerHTML = 'Lagu tidak ditemukan!';
            return;
        }

        results.forEach(video => {
            const li = document.createElement('li');
            li.style.cssText = `display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; cursor: pointer; margin-bottom: 5px;`;
            li.innerHTML = `<img src="${video.thumbnail}" style="width: 50px; border-radius: 4px;"> <span>${video.title}</span>`;
            
            li.addEventListener('click', async () => {
                ytSearchResults.innerHTML = '';
                ytStatusText.style.display = 'block';
                ytStatusText.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Mendownload <b>${video.title}</b>...`;
                const result = await ipcRenderer.invoke('download-yt', video.url);
                handleDownloadResult(result);
            });
            ytSearchResults.appendChild(li);
        });
    }
});

// 9. EVENT LISTENERS LAIN (Dropdown, Miniplayer, Custom Cover)
addMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); addDropdown.classList.toggle('show'); });
document.addEventListener('click', () => { if (addDropdown.classList.contains('show')) addDropdown.classList.remove('show'); });
importFileBtn.addEventListener('click', async () => {
    addDropdown.classList.remove('show');
    const files = await ipcRenderer.invoke('open-file-dialog');
    if (files && files.length > 0) {
        files.forEach(filePath => {
            try {
                const fileName = path.basename(filePath);
                const destPath = path.join(songsFolder, fileName);
                fs.copyFileSync(filePath, destPath);
            } catch (err) {
                console.error("Gagal mengimpor file:", filePath, err);
            }
        });
        loadPlaylist();
    }
});
importYtBtn.addEventListener('click', () => { addDropdown.classList.remove('show'); ytPopup.classList.add('show'); ytUrlInput.focus(); });
miniPlayerBtn.addEventListener('click', () => { isMiniMode = !isMiniMode; ipcRenderer.send('toggle-mini-player', isMiniMode); });
ipcRenderer.on('set-mini-mode', (_, isMini) => { isMiniMode = isMini; });
ipcRenderer.on('request-state-for-mini', syncToMiniPlayer);
audio.addEventListener("play", () => { ipcRenderer.send("player-state", true); syncToMiniPlayer(); });
audio.addEventListener("pause", () => { ipcRenderer.send("player-state", false); syncToMiniPlayer(); });

const uploadCoverBtn = document.getElementById('upload-cover-btn');
if (uploadCoverBtn) {
    uploadCoverBtn.addEventListener('click', async () => {
        if (playlist.length === 0) return;
        const currentSongName = path.parse(playlist[currentSongIndex]).name;
        const newCoverPath = await ipcRenderer.invoke('upload-custom-cover', currentSongName);
        if (newCoverPath) document.getElementById('album-art-img').src = `file://${newCoverPath}?t=${new Date().getTime()}`;
    });
    uploadCoverBtn.addEventListener('contextmenu', async (e) => {
        e.preventDefault(); 
        if (playlist.length === 0) return;
        const currentSongName = path.parse(playlist[currentSongIndex]).name;
        const isRemoved = await ipcRenderer.invoke('remove-custom-cover', currentSongName);
        if (isRemoved) extractMetadata(path.join(songsFolder, playlist[currentSongIndex]), currentSongName);
    });
}

ipcRenderer.on("thumb-play", () => togglePlay());
ipcRenderer.on("thumb-next", () => nextSong());
ipcRenderer.on("thumb-prev", () => prevSong());

// 10. LOGIKA SETTINGS (TRAY, NOTIFICATION, ALWAYS ON TOP)
const trayToggle = document.getElementById('tray-toggle');
const notificationToggle = document.getElementById('notification-toggle');
const ontopToggle = document.getElementById('ontop-toggle');

// Load & Terapkan System Tray
const savedTray = localStorage.getItem('njoy_tray');
const trayEnabled = savedTray !== null ? savedTray === 'true' : true;
if (trayToggle) {
    trayToggle.checked = trayEnabled;
    ipcRenderer.send('toggle-tray', trayEnabled);
    trayToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        localStorage.setItem('njoy_tray', enabled);
        ipcRenderer.send('toggle-tray', enabled);
    });
}

// Load & Terapkan Now Playing Notification
const savedNotification = localStorage.getItem('njoy_notification');
const notificationEnabledSetting = savedNotification !== null ? savedNotification === 'true' : true;
if (notificationToggle) {
    notificationToggle.checked = notificationEnabledSetting;
    ipcRenderer.send('toggle-notification', notificationEnabledSetting);
    notificationToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        localStorage.setItem('njoy_notification', enabled);
        ipcRenderer.send('toggle-notification', enabled);
    });
}

// Load & Terapkan Always On Top
const savedOntop = localStorage.getItem('njoy_ontop');
const ontopEnabled = savedOntop !== null ? savedOntop === 'true' : false;
if (ontopToggle) {
    ontopToggle.checked = ontopEnabled;
    ipcRenderer.send('toggle-ontop', ontopEnabled);
    ontopToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        localStorage.setItem('njoy_ontop', enabled);
        ipcRenderer.send('toggle-ontop', enabled);
    });
}

// Inisialisasi awal
loadPlaylist(true);
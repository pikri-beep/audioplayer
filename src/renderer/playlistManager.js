const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const { Vibrant } = require('node-vibrant/node');

function resetDefaultThemeColors() {
    const currentTheme = document.body.getAttribute('data-theme') || 'default';
    if (currentTheme === 'cosmic') {
        document.documentElement.style.setProperty('--theme-glow', '#00f0ff');
        document.documentElement.style.setProperty('--theme-border', 'rgba(0, 240, 255, 0.2)');
    } else {
        document.documentElement.style.setProperty('--theme-glow', '#a855f7');
        document.documentElement.style.setProperty('--theme-border', 'rgba(168, 85, 247, 0.2)');
    }
}

function loadPlaylist(isInitial = false) {
    const { audio, songTitleEl, songArtistEl, playBtn } = window.player.dom;
    const { songsFolder } = window.player.state;
    
    try {
        if (!fs.existsSync(songsFolder)) fs.mkdirSync(songsFolder);
        const oldSongName = window.player.state.playlist[window.player.state.currentSongIndex];
        
        window.player.state.playlist = fs.readdirSync(songsFolder).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp3', '.wav', '.m4a', '.ogg'].includes(ext);
        });
        window.player.state.unplayedShuffle = [];
        
        const playlist = window.player.state.playlist;
        if (playlist.length > 0) {
            if (oldSongName) {
                const newIndex = playlist.indexOf(oldSongName);
                if (newIndex !== -1) {
                    window.player.state.currentSongIndex = newIndex;
                } else {
                    window.player.state.currentSongIndex = 0;
                }
            } else {
                window.player.state.currentSongIndex = 0;
            }
            renderPlaylist();
            
            if (isInitial || !audio.src || audio.src === '' || audio.src.endsWith('/undefined') || audio.src.endsWith('\\undefined')) {
                loadSong(window.player.state.currentSongIndex);
            }
        } else {
            songTitleEl.innerText = "Playlist Kosong";
            songArtistEl.innerText = "Klik (+) untuk tambah mp3";
            audio.src = '';
            const albumArtImg = document.getElementById('album-art-img');
            if (albumArtImg) albumArtImg.src = "file://" + path.join(__dirname, "../../covers", "default.png");
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    } catch (err) {
        console.error(err);
    }
}

function renderPlaylist() {
    const { playlistUl } = window.player.dom;
    const { playlist, currentSongIndex, njoyList, currentMode } = window.player.state;
    
    if (!playlistUl) return;
    playlistUl.innerHTML = '';
    
    if (currentMode === 'njoy') {
        // Mode Queue: Iterasi langsung pada njoyList agar sesuai dengan urutan FIFO antrean
        njoyList.forEach((song, queueIndex) => {
            const mainIndex = playlist.indexOf(song);
            if (mainIndex === -1) return;
            
            const li = document.createElement('li');
            if (mainIndex === currentSongIndex) li.classList.add('active');
            
            const span = document.createElement('span');
            span.innerText = path.parse(song).name;
            span.style.flexGrow = '1';
            span.addEventListener('click', () => { 
                window.player.state.currentSongIndex = mainIndex; 
                window.player.audio.changeSongWithFade(mainIndex);
            });
            
            const heartBtn = document.createElement('button');
            heartBtn.className = 'heart-btn liked';
            heartBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
            heartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Hapus dari antrean
                window.player.state.njoyList = window.player.state.njoyList.filter(item => item !== song);
                localStorage.setItem('njoyList', JSON.stringify(window.player.state.njoyList));
                renderPlaylist();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            deleteBtn.title = 'Hapus Lagu';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSong(song);
            });

            li.appendChild(span);
            li.appendChild(heartBtn);
            li.appendChild(deleteBtn);
            playlistUl.appendChild(li);
        });
    } else {
        // Mode Semua: Iterasi seluruh lagu berdasarkan daftar alfabetis normal
        playlist.forEach((song, index) => {
            const isLiked = njoyList.includes(song);
            
            const li = document.createElement('li');
            if (index === currentSongIndex) li.classList.add('active');
            
            const span = document.createElement('span');
            span.innerText = path.parse(song).name;
            span.style.flexGrow = '1';
            span.addEventListener('click', () => { 
                window.player.state.currentSongIndex = index; 
                window.player.audio.changeSongWithFade(index);
            });
            
            const heartBtn = document.createElement('button');
            heartBtn.className = `heart-btn ${isLiked ? 'liked' : ''}`;
            heartBtn.innerHTML = isLiked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
            heartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.player.state.njoyList.includes(song)) {
                    window.player.state.njoyList = window.player.state.njoyList.filter(item => item !== song);
                } else {
                    window.player.state.njoyList.push(song);
                }
                localStorage.setItem('njoyList', JSON.stringify(window.player.state.njoyList));
                renderPlaylist();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            deleteBtn.title = 'Hapus Lagu';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSong(song);
            });

            li.appendChild(span);
            li.appendChild(heartBtn);
            li.appendChild(deleteBtn);
            playlistUl.appendChild(li);
        });
    }
}

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const popup = document.getElementById('confirm-popup');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const yesBtn = document.getElementById('confirm-yes-btn');
        const noBtn = document.getElementById('confirm-no-btn');
        
        titleEl.innerText = title;
        messageEl.innerText = message;
        
        popup.classList.add('show');
        
        const newYesBtn = yesBtn.cloneNode(true);
        const newNoBtn = noBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
        noBtn.parentNode.replaceChild(newNoBtn, noBtn);
        
        newYesBtn.addEventListener('click', () => {
            popup.classList.remove('show');
            resolve(true);
        });
        
        newNoBtn.addEventListener('click', () => {
            popup.classList.remove('show');
            resolve(false);
        });
    });
}

async function deleteSong(songName) {
    const { songsFolder, njoyList, playlist, currentSongIndex } = window.player.state;
    const { audio, songTitleEl, songArtistEl, playBtn } = window.player.dom;
    
    const songCleanName = path.parse(songName).name;
    const confirmed = await showCustomConfirm(
        "Hapus Lagu?",
        `Apakah Anda yakin ingin menghapus lagu "${songCleanName}"?`
    );
    if (!confirmed) return;
    
    try {
        const filePath = path.join(songsFolder, songName);
        
        // 1. Hapus file audio dari disk
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        // 2. Hapus file cover custom jika ada
        const cleanName = path.parse(songName).name;
        const coverPath = path.join(__dirname, '../../covers', `${cleanName}-cover.jpg`);
        if (fs.existsSync(coverPath)) {
            try {
                fs.unlinkSync(coverPath);
            } catch (e) {
                console.error("Gagal menghapus cover custom:", e.message);
            }
        }
        
        // 3. Hapus dari njoyList (Favorites) jika ada
        if (njoyList.includes(songName)) {
            window.player.state.njoyList = njoyList.filter(item => item !== songName);
            localStorage.setItem('njoyList', JSON.stringify(window.player.state.njoyList));
        }
        
        // 4. Perbarui status pemutaran
        const deletedIndex = playlist.indexOf(songName);
        
        // Baca ulang daftar lagu dari folder
        window.player.state.playlist = fs.readdirSync(songsFolder).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp3', '.wav', '.m4a', '.ogg'].includes(ext);
        });
        
        const newPlaylist = window.player.state.playlist;
        
        if (newPlaylist.length === 0) {
            audio.pause();
            audio.src = '';
            window.player.state.currentSongIndex = 0;
            songTitleEl.innerText = "Playlist Kosong";
            songArtistEl.innerText = "Klik (+) untuk tambah mp3";
            const albumArtImg = document.getElementById('album-art-img');
            if (albumArtImg) albumArtImg.src = "file://" + path.join(__dirname, "../../covers", "default.png");
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            renderPlaylist();
            return;
        }
        
        if (deletedIndex === currentSongIndex) {
            let nextIndex = currentSongIndex;
            if (nextIndex >= newPlaylist.length) {
                nextIndex = 0;
            }
            audio.pause();
            loadSong(nextIndex);
            audio.play().catch(err => console.log(err));
            playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        } else {
            if (deletedIndex < currentSongIndex) {
                window.player.state.currentSongIndex--;
            }
            renderPlaylist();
        }
        
    } catch (err) {
        console.error("Gagal menghapus lagu:", err.message);
        alert("Gagal menghapus lagu: " + err.message);
    }
}

function loadSong(index) {
    const { playlist, songsFolder } = window.player.state;
    const { audio, songTitleEl, songArtistEl, playBtn } = window.player.dom;
    
    if (playlist.length === 0) return;
    if (index < 0 || index >= playlist.length) {
        index = 0;
    }
    window.player.state.currentSongIndex = index;
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

async function extractMetadata(filePath, cleanName) {
    const albumArtImg = document.getElementById('album-art-img');
    const specificCover = path.join(__dirname, '../../covers', `${cleanName}-cover.jpg`);
    const hasCustomCover = fs.existsSync(specificCover);
    const { songTitleEl, songArtistEl } = window.player.dom;
    const { isMiniMode } = window.player.state;
    
    let finalTitle = songTitleEl.innerText;
    let finalArtist = songArtistEl.innerText;

    try {
        const metadata = await ipcRenderer.invoke('get-metadata', filePath);
        
        if (metadata) {
            if (metadata.title) { finalTitle = metadata.title; songTitleEl.innerText = finalTitle; }
            if (metadata.artist) { finalArtist = metadata.artist; songArtistEl.innerText = finalArtist; }
        }

        if (window.player.lyrics && window.player.lyrics.fetchLyrics) {
            window.player.lyrics.fetchLyrics(finalArtist, finalTitle);
        }

        let finalCoverPath = hasCustomCover ? specificCover : (metadata && metadata.coverPath ? metadata.coverPath : null);
        albumArtImg.src = finalCoverPath ? `file://${finalCoverPath}?t=${new Date().getTime()}` : "file://" + path.join(__dirname, "../../covers", "default.png");
        
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
                if (isMiniMode && window.player.audio && window.player.audio.syncToMiniPlayer) {
                    window.player.audio.syncToMiniPlayer();
                }
            }).catch(() => {
                resetDefaultThemeColors();
                if (isMiniMode && window.player.audio && window.player.audio.syncToMiniPlayer) {
                    window.player.audio.syncToMiniPlayer();
                }
            });
        } else {
            resetDefaultThemeColors();
            if (isMiniMode && window.player.audio && window.player.audio.syncToMiniPlayer) {
                window.player.audio.syncToMiniPlayer();
            }
        }

    } catch (error) {
        albumArtImg.src = "file://" + path.join(__dirname, "../../covers", "default.png");
        resetDefaultThemeColors();
        if (window.player.lyrics && window.player.lyrics.fetchLyrics) {
            window.player.lyrics.fetchLyrics(finalArtist, finalTitle);
        }
        if (isMiniMode && window.player.audio && window.player.audio.syncToMiniPlayer) {
            window.player.audio.syncToMiniPlayer();
        }
    }
}

// Daftarkan ke Global Registry
window.player.playlistManager = {
    resetDefaultThemeColors,
    loadPlaylist,
    renderPlaylist,
    showCustomConfirm,
    deleteSong,
    loadSong,
    extractMetadata
};

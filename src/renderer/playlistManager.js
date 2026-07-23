const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const { Vibrant } = require('node-vibrant/node');

const playlistsFilePath = path.join(__dirname, '../../playlists.json');

function resetDefaultThemeColors() {
    const currentTheme = document.body.getAttribute('data-theme') || 'default';
    if (currentTheme === 'cosmic') {
        document.documentElement.style.setProperty('--theme-glow', '#00f0ff');
        document.documentElement.style.setProperty('--theme-border', 'rgba(0, 240, 255, 0.2)');
    } else if (currentTheme === 'disco') {
        document.documentElement.style.setProperty('--theme-glow', '#ff007f');
        document.documentElement.style.setProperty('--theme-border', 'rgba(255, 0, 127, 0.4)');
    } else {
        document.documentElement.style.setProperty('--theme-glow', '#a855f7');
        document.documentElement.style.setProperty('--theme-border', 'rgba(168, 85, 247, 0.2)');
    }
}

// ------------------------------------------------------------------
// CUSTOM PLAYLIST DATA FUNCTIONS
// ------------------------------------------------------------------
function getCustomPlaylists() {
    try {
        if (fs.existsSync(playlistsFilePath)) {
            return JSON.parse(fs.readFileSync(playlistsFilePath, 'utf8'));
        }
    } catch (e) {
        console.error("Gagal membaca playlists.json:", e);
    }
    return [];
}

function saveCustomPlaylists(playlists) {
    try {
        fs.writeFileSync(playlistsFilePath, JSON.stringify(playlists, null, 2));
    } catch (e) {
        console.error("Gagal menyimpan playlists.json:", e);
    }
}

function createCustomPlaylist(name) {
    if (!name || !name.trim()) return null;
    const cleanName = name.trim();
    const playlists = getCustomPlaylists();
    
    if (playlists.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
        alert("Playlist dengan nama ini sudah ada!");
        return null;
    }
    
    const newPlaylist = {
        id: 'pl-' + Date.now(),
        name: cleanName,
        songs: []
    };
    
    playlists.push(newPlaylist);
    saveCustomPlaylists(playlists);
    renderCustomPlaylistTabs();
    return newPlaylist;
}

async function deleteCustomPlaylist(playlistId) {
    const playlists = getCustomPlaylists();
    const target = playlists.find(p => p.id === playlistId);
    if (!target) return;
    
    const confirmed = await showCustomConfirm(
        "Hapus Playlist?",
        `Apakah Anda yakin ingin menghapus playlist "${target.name}"? (Lagu di disk tidak akan terhapus)`
    );
    if (!confirmed) return;
    
    const updated = playlists.filter(p => p.id !== playlistId);
    saveCustomPlaylists(updated);
    
    if (window.player.state.currentMode === playlistId) {
        switchPlaylistMode('all');
    } else {
        renderCustomPlaylistTabs();
        renderPlaylist();
    }
}

function addSongToCustomPlaylist(playlistId, songName) {
    const playlists = getCustomPlaylists();
    const target = playlists.find(p => p.id === playlistId);
    if (!target) return false;
    
    if (!target.songs.includes(songName)) {
        target.songs.push(songName);
        saveCustomPlaylists(playlists);
    }
    return true;
}

function removeSongFromCustomPlaylist(playlistId, songName) {
    const playlists = getCustomPlaylists();
    const target = playlists.find(p => p.id === playlistId);
    if (!target) return false;
    
    target.songs = target.songs.filter(s => s !== songName);
    saveCustomPlaylists(playlists);
    
    if (window.player.state.currentMode === playlistId) {
        switchPlaylistMode(playlistId);
    } else {
        renderPlaylist();
    }
    return true;
}

function switchPlaylistMode(modeId) {
    window.player.state.currentMode = modeId;
    const { songsFolder } = window.player.state;
    
    let allFiles = [];
    if (fs.existsSync(songsFolder)) {
        allFiles = fs.readdirSync(songsFolder).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp3', '.wav', '.m4a', '.ogg'].includes(ext);
        });
    }

    if (modeId === 'all') {
        window.player.state.playlist = allFiles;
    } else if (modeId === 'njoy') {
        window.player.state.playlist = allFiles;
    } else {
        // Custom playlist mode
        const playlists = getCustomPlaylists();
        const customPl = playlists.find(p => p.id === modeId);
        if (customPl) {
            window.player.state.playlist = customPl.songs.filter(s => allFiles.includes(s));
        } else {
            window.player.state.playlist = allFiles;
        }
    }
    
    window.player.state.unplayedShuffle = [];
    window.player.state.currentSongIndex = 0;
    renderCustomPlaylistTabs();
    renderPlaylist();
}

function renderCustomPlaylistTabs() {
    const container = document.getElementById('custom-playlist-tabs');
    if (!container) return;
    container.innerHTML = '';
    
    const playlists = getCustomPlaylists();
    const activeMode = window.player.state.currentMode;
    
    const btnAll = document.getElementById('btn-mode-all');
    const btnNjoy = document.getElementById('btn-mode-njoy');
    if (btnAll) btnAll.className = `mode-btn ${activeMode === 'all' ? 'active' : ''}`;
    if (btnNjoy) btnNjoy.className = `mode-btn ${activeMode === 'njoy' ? 'active' : ''}`;
    
    playlists.forEach(pl => {
        const btn = document.createElement('button');
        btn.className = `mode-btn ${activeMode === pl.id ? 'active' : ''}`;
        btn.style.whiteSpace = 'nowrap';
        btn.innerHTML = `<i class="fa-solid fa-list-ul"></i> ${pl.name}`;
        btn.addEventListener('click', () => switchPlaylistMode(pl.id));
        container.appendChild(btn);
    });
}

function openAddToPlaylistModal(songName) {
    const modal = document.getElementById('add-to-playlist-popup');
    const titleName = document.getElementById('add-to-playlist-song-name');
    const list = document.getElementById('custom-playlists-selector-list');
    
    if (!modal || !list) return;
    
    const cleanName = path.parse(songName).name;
    if (titleName) titleName.innerText = `Lagu: ${cleanName}`;
    list.innerHTML = '';
    
    const playlists = getCustomPlaylists();
    if (playlists.length === 0) {
        list.innerHTML = '<li style="color:#aaa; font-size:12px; text-align:center; padding:10px;">Belum ada playlist kustom. Klik "+ Baru" di atas untuk membuat playlist!</li>';
    } else {
        playlists.forEach(pl => {
            const isAlreadyAdded = pl.songs.includes(songName);
            const li = document.createElement('li');
            li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px 12px; border-radius:8px; cursor:pointer; font-size:13px;';
            
            li.innerHTML = `
                <span><i class="fa-solid fa-folder"></i> ${pl.name} (${pl.songs.length} lagu)</span>
                <button class="mode-btn ${isAlreadyAdded ? '' : 'active'}" style="padding:4px 10px; font-size:11px;">
                    ${isAlreadyAdded ? '<i class="fa-solid fa-check"></i> Ada' : '<i class="fa-solid fa-plus"></i> Tambah'}
                </button>
            `;
            
            li.addEventListener('click', () => {
                if (isAlreadyAdded) {
                    removeSongFromCustomPlaylist(pl.id, songName);
                } else {
                    addSongToCustomPlaylist(pl.id, songName);
                }
                openAddToPlaylistModal(songName);
            });
            
            list.appendChild(li);
        });
    }
    
    modal.classList.add('show');
}

// ------------------------------------------------------------------
// PLAYLIST RENDER & PLAYBACK FUNCTIONS
// ------------------------------------------------------------------
function loadPlaylist(isInitial = false) {
    const { audio, songTitleEl, songArtistEl, playBtn } = window.player.dom;
    const { songsFolder } = window.player.state;
    
    try {
        if (!fs.existsSync(songsFolder)) fs.mkdirSync(songsFolder);
        const oldSongName = window.player.state.playlist[window.player.state.currentSongIndex];
        
        switchPlaylistMode(window.player.state.currentMode || 'all');
        
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
            renderCustomPlaylistTabs();
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
        // Mode Queue: Iterasi FIFO njoyList
        njoyList.forEach((song) => {
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
                window.player.state.njoyList = window.player.state.njoyList.filter(item => item !== song);
                localStorage.setItem('njoyList', JSON.stringify(window.player.state.njoyList));
                renderPlaylist();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            deleteBtn.title = 'Hapus Lagu dari Disk';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSong(song);
            });

            li.appendChild(span);
            li.appendChild(heartBtn);
            li.appendChild(deleteBtn);
            playlistUl.appendChild(li);
        });
    } else if (currentMode !== 'all' && currentMode !== 'njoy') {
        // Mode Custom Playlist
        const playlists = getCustomPlaylists();
        const customPl = playlists.find(p => p.id === currentMode);
        
        if (customPl) {
            // Header bar untuk playlist kustom
            const headerLi = document.createElement('li');
            headerLi.style.cssText = 'background: rgba(255,255,255,0.08); border-color: var(--theme-glow); margin-bottom: 12px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center;';
            headerLi.innerHTML = `
                <span><i class="fa-solid fa-folder-open" style="color:var(--theme-glow)"></i> ${customPl.name} (${playlist.length} lagu)</span>
                <button id="delete-this-playlist-btn" class="mode-btn" style="padding:4px 10px; font-size:11px; color:#ef4444; border-color:rgba(239,68,68,0.4);">
                    <i class="fa-solid fa-folder-minus"></i> Hapus Playlist
                </button>
            `;
            playlistUl.appendChild(headerLi);
            
            const delPlBtn = headerLi.querySelector('#delete-this-playlist-btn');
            if (delPlBtn) {
                delPlBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteCustomPlaylist(currentMode);
                });
            }
        }

        if (playlist.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.style.cssText = 'color:#aaa; text-align:center; font-size:12px; padding:15px;';
            emptyLi.innerText = 'Playlist ini masih kosong. Pindah ke tab "Semua" lalu klik (+) pada lagu untuk memasukkan lagu!';
            playlistUl.appendChild(emptyLi);
            return;
        }

        playlist.forEach((song, index) => {
            const li = document.createElement('li');
            if (index === currentSongIndex) li.classList.add('active');
            
            const span = document.createElement('span');
            span.innerText = path.parse(song).name;
            span.style.flexGrow = '1';
            span.addEventListener('click', () => { 
                window.player.state.currentSongIndex = index; 
                window.player.audio.changeSongWithFade(index);
            });
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'delete-btn';
            removeBtn.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
            removeBtn.title = 'Keluarkan dari Playlist ini';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeSongFromCustomPlaylist(currentMode, song);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            deleteBtn.title = 'Hapus File dari Disk';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSong(song);
            });

            li.appendChild(span);
            li.appendChild(removeBtn);
            li.appendChild(deleteBtn);
            playlistUl.appendChild(li);
        });
    } else {
        // Mode Semua Lagu
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
            
            const addPlBtn = document.createElement('button');
            addPlBtn.className = 'sub-control-btn';
            addPlBtn.style.cssText = 'background:none; border:none; color:var(--theme-glow); font-size:14px; cursor:pointer; padding:4px 6px;';
            addPlBtn.innerHTML = '<i class="fa-solid fa-folder-plus"></i>';
            addPlBtn.title = 'Tambahkan ke Playlist';
            addPlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAddToPlaylistModal(song);
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
            deleteBtn.title = 'Hapus File dari Disk';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSong(song);
            });

            li.appendChild(span);
            li.appendChild(addPlBtn);
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
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        const cleanName = path.parse(songName).name;
        const coverPath = path.join(__dirname, '../../covers', `${cleanName}-cover.jpg`);
        if (fs.existsSync(coverPath)) {
            try {
                fs.unlinkSync(coverPath);
            } catch (e) {
                console.error("Gagal menghapus cover custom:", e.message);
            }
        }
        
        if (njoyList.includes(songName)) {
            window.player.state.njoyList = njoyList.filter(item => item !== songName);
            localStorage.setItem('njoyList', JSON.stringify(window.player.state.njoyList));
        }
        
        switchPlaylistMode(window.player.state.currentMode || 'all');
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
        
        loadSong(0);
        audio.play().catch(err => console.log(err));
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        
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
    extractMetadata,
    getCustomPlaylists,
    saveCustomPlaylists,
    createCustomPlaylist,
    deleteCustomPlaylist,
    addSongToCustomPlaylist,
    removeSongFromCustomPlaylist,
    switchPlaylistMode,
    renderCustomPlaylistTabs,
    openAddToPlaylistModal
};

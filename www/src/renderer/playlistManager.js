const fs = (typeof require !== 'undefined') ? require('fs') : null;
const path = (typeof require !== 'undefined') ? require('path') : null;
const { ipcRenderer } = (typeof require !== 'undefined' && require('electron')) ? require('electron') : { ipcRenderer: null };
const Vibrant = (typeof require !== 'undefined') ? (() => { try { return require('node-vibrant/node').Vibrant; } catch(e) { return null; } })() : null;

const playlistsFilePath = (path && typeof __dirname !== 'undefined') ? path.join(__dirname, '../../playlists.json') : null;

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
// CUSTOM PLAYLIST DATA STORAGE
// ------------------------------------------------------------------
function getCustomPlaylists() {
    try {
        if (!fs || !playlistsFilePath) return [];
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
        if (!fs || !playlistsFilePath) return;
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
    
    if (window.player.state.activePlaylistId === playlistId) {
        window.player.state.activePlaylistId = null;
        switchPlaylistTab('playlist');
    } else {
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
    
    if (window.player.state.activePlaylistId === playlistId) {
        switchPlaylistTab('active_playlist');
    } else {
        renderPlaylist();
    }
    return true;
}

// ------------------------------------------------------------------
// TAB SWITCHING & PLAYLIST SCOPING LOGIC
// ------------------------------------------------------------------
function switchPlaylistTab(tabName, customPlaylistId = null) {
    window.player.state.currentTab = tabName; // 'all', 'active_playlist', 'playlist'
    const { songsFolder } = window.player.state;
    
    let allFiles = [];
    if (fs && fs.existsSync(songsFolder)) {
        allFiles = fs.readdirSync(songsFolder).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp3', '.wav', '.m4a', '.ogg'].includes(ext);
        });
    }

    if (customPlaylistId) {
        window.player.state.activePlaylistId = customPlaylistId;
        window.player.state.currentTab = 'active_playlist';
    }

    const activePlId = window.player.state.activePlaylistId;

    if (window.player.state.currentTab === 'all') {
        window.player.state.playlist = allFiles;
        window.player.state.currentMode = 'all';
    } else if (window.player.state.currentTab === 'active_playlist') {
        if (activePlId) {
            const playlists = getCustomPlaylists();
            const customPl = playlists.find(p => p.id === activePlId);
            if (customPl) {
                window.player.state.playlist = customPl.songs.filter(s => allFiles.includes(s));
                window.player.state.currentMode = activePlId;
            } else {
                window.player.state.playlist = allFiles;
                window.player.state.currentMode = 'all';
                window.player.state.activePlaylistId = null;
            }
        } else {
            window.player.state.playlist = allFiles;
            window.player.state.currentMode = 'njoy';
        }
    } else {
        // 'playlist' tab: Playlist Manager Menu
        window.player.state.playlist = allFiles;
    }
    
    window.player.state.unplayedShuffle = [];
    updateTabHeaderUI();
    renderPlaylist();
}

function updateTabHeaderUI() {
    const btnAll = document.getElementById('btn-mode-all');
    const btnQueue = document.getElementById('btn-mode-queue');
    const btnPlaylist = document.getElementById('btn-mode-playlist');
    const queueText = document.getElementById('tab-queue-text');
    
    const currentTab = window.player.state.currentTab || 'all';
    const activePlId = window.player.state.activePlaylistId;
    
    if (btnAll) btnAll.className = `mode-btn ${currentTab === 'all' ? 'active' : ''}`;
    if (btnQueue) btnQueue.className = `mode-btn ${currentTab === 'active_playlist' ? 'active' : ''}`;
    if (btnPlaylist) btnPlaylist.className = `mode-btn ${currentTab === 'playlist' ? 'active' : ''}`;
    
    if (queueText) {
        if (activePlId) {
            const playlists = getCustomPlaylists();
            const customPl = playlists.find(p => p.id === activePlId);
            if (customPl) {
                queueText.innerHTML = `<i class="fa-solid fa-list-ul"></i> ${customPl.name}`;
            } else {
                queueText.innerHTML = `Queue`;
            }
        } else {
            queueText.innerHTML = `Queue`;
        }
    }
}

function openAddToPlaylistModal(songName) {
    const modal = document.getElementById('add-to-playlist-popup');
    const titleName = document.getElementById('add-to-playlist-song-name');
    const list = document.getElementById('custom-playlists-selector-list');
    
    if (!modal || !list) return;
    
    const cleanName = path ? path.parse(songName).name : songName.replace(/\.[^/.]+$/, '');
    if (titleName) titleName.innerText = `Lagu: ${cleanName}`;
    list.innerHTML = '';
    
    const playlists = getCustomPlaylists();
    if (playlists.length === 0) {
        list.innerHTML = '<li style="color:#aaa; font-size:12px; text-align:center; padding:15px; background:transparent; border:none;">Belum ada playlist kustom. Buka tab "Playlist" lalu buat playlist baru!</li>';
    } else {
        playlists.forEach(pl => {
            const isAlreadyAdded = pl.songs.includes(songName);
            const li = document.createElement('li');
            li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px 12px; border-radius:10px; cursor:pointer; font-size:13px; border:1px solid rgba(255,255,255,0.08); transition:0.2s;';
            
            li.innerHTML = `
                <span><i class="fa-solid fa-folder" style="color:var(--theme-glow); margin-right:6px;"></i> ${pl.name} (${pl.songs.length} lagu)</span>
                <button class="mode-btn ${isAlreadyAdded ? '' : 'active'}" style="padding:4px 10px; font-size:11px; flex:none;">
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
// RENDER PLAYLIST LIST & PLAYLIST MANAGER MENU
// ------------------------------------------------------------------
function loadPlaylist(isInitial = false) {
    const { audio, songTitleEl, songArtistEl, playBtn } = window.player.dom;
    const { songsFolder } = window.player.state;
    
    try {
        if (!fs) return;
        if (!fs.existsSync(songsFolder)) fs.mkdirSync(songsFolder);
        const oldSongName = window.player.state.playlist[window.player.state.currentSongIndex];
        
        switchPlaylistTab(window.player.state.currentTab || 'all');
        
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
            
            if (isInitial || !audio.src || audio.src === '' || audio.src.endsWith('/undefined') || audio.src.endsWith('\\undefined')) {
                loadSong(window.player.state.currentSongIndex);
            }
        } else {
            songTitleEl.innerText = "Playlist Kosong";
            songArtistEl.innerText = "Klik (+) untuk tambah mp3";
            audio.src = '';
            const albumArtImg = document.getElementById('album-art-img');
            const defaultCover = path ? ("file://" + path.join(__dirname, "../../covers", "default.png")) : "assets/logo.png";
            if (albumArtImg) albumArtImg.src = defaultCover;
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    } catch (err) {
        console.error(err);
    }
}

function renderPlaylist() {
    const { playlistUl } = window.player.dom;
    const { playlist, currentSongIndex, njoyList, currentTab, activePlaylistId } = window.player.state;
    const searchBar = document.getElementById('search-bar');
    const searchQuery = searchBar ? searchBar.value.trim().toLowerCase() : '';
    
    if (!playlistUl) return;
    playlistUl.innerHTML = '';
    
    // ------------------------------------------------------------------
    // TAB 3: PLAYLIST MANAGER MENU
    // ------------------------------------------------------------------
    if (currentTab === 'playlist') {
        const playlists = getCustomPlaylists();
        
        // Button: Create New Playlist
        const createLi = document.createElement('li');
        createLi.style.cssText = 'background: rgba(255, 255, 255, 0.06); border: 1px dashed var(--theme-glow); border-radius: 12px; padding: 12px; display: flex; justify-content: center; align-items: center; gap: 8px; cursor: pointer; color: var(--theme-glow); font-weight: 600; font-size: 13px; margin-bottom: 10px; transition: 0.2s;';
        createLi.innerHTML = '<i class="fa-solid fa-folder-plus"></i> Buat Playlist Baru';
        createLi.addEventListener('click', () => {
            const createModal = document.getElementById('create-playlist-popup');
            const input = document.getElementById('new-playlist-name');
            if (input) input.value = '';
            if (createModal) createModal.classList.add('show');
        });
        playlistUl.appendChild(createLi);
        
        if (playlists.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.style.cssText = 'color:#aaa; text-align:center; font-size:12px; padding:20px; background:transparent; border:none;';
            emptyLi.innerText = 'Belum ada playlist kustom. Klik "Buat Playlist Baru" di atas!';
            playlistUl.appendChild(emptyLi);
            return;
        }

        playlists.forEach(pl => {
            if (searchQuery && !pl.name.toLowerCase().includes(searchQuery)) return;

            const li = document.createElement('li');
            li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:6px; transition:0.2s;';
            
            const isCurrentlyActive = (activePlaylistId === pl.id);
            if (isCurrentlyActive) {
                li.style.borderColor = 'var(--theme-glow)';
                li.style.background = 'rgba(255,255,255,0.08)';
            }
            
            li.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px; flex-grow:1; overflow:hidden; margin-right:10px;">
                    <span style="font-weight:600; font-size:14px; color:${isCurrentlyActive ? 'var(--theme-glow)' : '#fff'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        <i class="fa-solid fa-folder" style="color:var(--theme-glow); margin-right:6px;"></i>${pl.name}
                    </span>
                    <span style="font-size:11px; color:#94a3b8;">${pl.songs.length} lagu ${isCurrentlyActive ? '• (Sedang Diputar)' : ''}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="mode-btn active play-pl-btn" style="padding:6px 12px; font-size:11px; flex:none;">
                        <i class="fa-solid fa-play"></i> Putar
                    </button>
                    <button class="delete-btn del-pl-btn" title="Hapus Playlist" style="padding:6px; font-size:13px; color:#ef4444; background:none; border:none; cursor:pointer;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            
            // Event: Play / Switch to Custom Playlist
            li.querySelector('.play-pl-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                switchPlaylistTab('active_playlist', pl.id);
            });
            
            li.addEventListener('click', () => {
                switchPlaylistTab('active_playlist', pl.id);
            });
            
            // Event: Delete Custom Playlist
            li.querySelector('.del-pl-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCustomPlaylist(pl.id);
            });
            
            playlistUl.appendChild(li);
        });

        return;
    }

    // ------------------------------------------------------------------
    // TAB 2: ACTIVE PLAYLIST / QUEUE VIEW
    // ------------------------------------------------------------------
    if (currentTab === 'active_playlist') {
        if (activePlaylistId) {
            // Viewing Custom Playlist
            const playlists = getCustomPlaylists();
            const customPl = playlists.find(p => p.id === activePlaylistId);
            
            if (customPl) {
                const headerLi = document.createElement('li');
                headerLi.style.cssText = 'background: rgba(255,255,255,0.06); border-color: var(--theme-glow); margin-bottom: 10px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; border-radius: 10px; padding: 10px 12px;';
                headerLi.innerHTML = `
                    <span style="font-weight:bold; color:var(--theme-glow);"><i class="fa-solid fa-folder-open"></i> ${customPl.name} (${playlist.length} lagu)</span>
                    <button id="clear-active-playlist-btn" class="mode-btn" style="padding:4px 8px; font-size:10px; color:#ef4444; border:1px solid rgba(239,68,68,0.4);">
                        <i class="fa-solid fa-arrow-left"></i> Kembali ke Queue
                    </button>
                `;
                playlistUl.appendChild(headerLi);
                
                headerLi.querySelector('#clear-active-playlist-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.player.state.activePlaylistId = null;
                    switchPlaylistTab('active_playlist');
                });
            }

            if (playlist.length === 0) {
                const emptyLi = document.createElement('li');
                emptyLi.style.cssText = 'color:#aaa; text-align:center; font-size:12px; padding:20px; background:transparent; border:none;';
                emptyLi.innerText = 'Playlist ini masih kosong. Pindah ke tab "Semua" lalu klik (+) pada lagu untuk memasukkan lagu!';
                playlistUl.appendChild(emptyLi);
                return;
            }

            playlist.forEach((song, index) => {
                if (searchQuery && !song.toLowerCase().includes(searchQuery)) return;

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
                    removeSongFromCustomPlaylist(activePlaylistId, song);
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
            return;
        } else {
            // Viewing Default FIFO Queue
            if (njoyList.length === 0) {
                const emptyLi = document.createElement('li');
                emptyLi.style.cssText = 'color:#aaa; text-align:center; font-size:12px; padding:20px; background:transparent; border:none;';
                emptyLi.innerText = 'Queue antrean kosong. Klik ikon hati (♥) pada lagu di tab "Semua" untuk menambah ke Queue!';
                playlistUl.appendChild(emptyLi);
                return;
            }

            njoyList.forEach((song) => {
                if (searchQuery && !song.toLowerCase().includes(searchQuery)) return;
                const mainIndex = playlist.indexOf(song);
                if (mainIndex === -1) return;
                
                const li = document.createElement('li');
                if (mainIndex === currentSongIndex) li.classList.add('active');
                
                const span = document.createElement('span');
                span.innerText = path ? path.parse(song).name : song.replace(/\.[^/.]+$/, '');
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
                deleteBtn.title = 'Hapus File dari Disk';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteSong(song);
                });

                li.appendChild(span);
                li.appendChild(heartBtn);
                li.appendChild(deleteBtn);
                playlistUl.appendChild(li);
            });
            return;
        }
    }

    // ------------------------------------------------------------------
    // TAB 1: ALL SONGS VIEW
    // ------------------------------------------------------------------
    playlist.forEach((song, index) => {
        if (searchQuery && !song.toLowerCase().includes(searchQuery)) return;
        const isLiked = njoyList.includes(song);
        
        const li = document.createElement('li');
        if (index === currentSongIndex) li.classList.add('active');
        
        const span = document.createElement('span');
        span.innerText = path ? path.parse(song).name : song.replace(/\.[^/.]+$/, '');
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
    const { songsFolder, njoyList, currentSongIndex } = window.player.state;
    const { audio, songTitleEl, songArtistEl, playBtn } = window.player.dom;
    
    const songCleanName = path ? path.parse(songName).name : songName.replace(/\.[^/.]+$/, '');
    const confirmed = await showCustomConfirm(
        "Hapus Lagu?",
        `Apakah Anda yakin ingin menghapus lagu "${songCleanName}" dari disk?`
    );
    if (!confirmed) return;
    
    try {
        const filePath = path ? path.join(songsFolder, songName) : songName;
        
        if (fs && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        const cleanName = path ? path.parse(songName).name : songName.replace(/\.[^/.]+$/, '');
        const coverPath = (path && typeof __dirname !== 'undefined') ? path.join(__dirname, '../../covers', `${cleanName}-cover.jpg`) : null;
        if (fs && coverPath && fs.existsSync(coverPath)) {
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
        
        switchPlaylistTab(window.player.state.currentTab || 'all');
        const newPlaylist = window.player.state.playlist;
        
        if (newPlaylist.length === 0) {
            audio.pause();
            audio.src = '';
            window.player.state.currentSongIndex = 0;
            songTitleEl.innerText = "Playlist Kosong";
            songArtistEl.innerText = "Klik (+) untuk tambah mp3";
            const albumArtImg = document.getElementById('album-art-img');
            const defaultCover = path ? ("file://" + path.join(__dirname, "../../covers", "default.png")) : "assets/logo.png";
            if (albumArtImg) albumArtImg.src = defaultCover;
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
    const { audio, songTitleEl, songArtistEl } = window.player.dom;
    
    if (playlist.length === 0) return;
    if (index < 0 || index >= playlist.length) {
        index = 0;
    }
    window.player.state.currentSongIndex = index;
    const songName = playlist[index];
    const filePath = path ? path.join(songsFolder, songName) : songName;
    audio.src = path ? `file://${filePath}` : filePath;
    renderPlaylist();
    
    const cleanName = path ? path.parse(songName).name : songName.replace(/\.[^/.]+$/, '');
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
    const specificCover = (path && typeof __dirname !== 'undefined') ? path.join(__dirname, '../../covers', `${cleanName}-cover.jpg`) : null;
    const hasCustomCover = (fs && specificCover) ? fs.existsSync(specificCover) : false;
    const { songTitleEl, songArtistEl } = window.player.dom;
    const { isMiniMode } = window.player.state;
    
    let finalTitle = songTitleEl.innerText;
    let finalArtist = songArtistEl.innerText;

    try {
        const metadata = ipcRenderer ? await ipcRenderer.invoke('get-metadata', filePath) : null;
        
        if (metadata) {
            if (metadata.title) { finalTitle = metadata.title; songTitleEl.innerText = finalTitle; }
            if (metadata.artist) { finalArtist = metadata.artist; songArtistEl.innerText = finalArtist; }
        }

        if (window.player.lyrics && window.player.lyrics.fetchLyrics) {
            window.player.lyrics.fetchLyrics(finalArtist, finalTitle);
        }

        let finalCoverPath = hasCustomCover ? specificCover : (metadata && metadata.coverPath ? metadata.coverPath : null);
        const defaultCover = path ? ("file://" + path.join(__dirname, "../../covers", "default.png")) : "assets/logo.png";
        albumArtImg.src = finalCoverPath ? `file://${finalCoverPath}?t=${new Date().getTime()}` : defaultCover;
        
        if (ipcRenderer) ipcRenderer.send("show-notification", {
            title: finalTitle,
            artist: finalArtist,
            cover: finalCoverPath || "covers/default.png"
        });

        if (finalCoverPath && Vibrant) {
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
        const defaultCover = path ? ("file://" + path.join(__dirname, "../../covers", "default.png")) : "assets/logo.png";
        albumArtImg.src = defaultCover;
        resetDefaultThemeColors();
        if (window.player.lyrics && window.player.lyrics.fetchLyrics) {
            window.player.lyrics.fetchLyrics(finalArtist, finalTitle);
        }
        if (isMiniMode && window.player.audio && window.player.audio.syncToMiniPlayer) {
            window.player.audio.syncToMiniPlayer();
        }
    }
}

// Global Registry
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
    switchPlaylistTab,
    openAddToPlaylistModal
};

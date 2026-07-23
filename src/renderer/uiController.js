const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

function initializeUiListeners() {
    const { 
        audio, playBtn, prevBtn, nextBtn, shuffleBtn, repeatBtn, progressBar,
        currentTimeEl, durationEl, songTitleEl, songArtistEl, playlistUl,
        playlistPopup, playlistToggleBtn, closePopupBtn,
        addMenuBtn, addDropdown, importFileBtn, importYtBtn, miniPlayerBtn,
        volumeSlider, volumeText, volumeIcon, lyricsToggleBtn, lyricsPopup,
        closeLyricsBtn, uploadCoverBtn
    } = window.player.dom;

    const { songsFolder } = window.player.state;

    // 1. Playback click listeners
    if (playBtn) playBtn.addEventListener('click', window.player.audio.togglePlay);
    if (nextBtn) nextBtn.addEventListener('click', () => window.player.audio.nextSong(false));
    if (prevBtn) prevBtn.addEventListener('click', () => window.player.audio.prevSong(false));
    
    if (audio) {
        audio.addEventListener('ended', () => window.player.audio.nextSong(true));
        
        audio.addEventListener('timeupdate', () => {
            if (audio.duration) {
                progressBar.value = (audio.currentTime / audio.duration) * 100;
                let m = Math.floor(audio.currentTime / 60), s = Math.floor(audio.currentTime % 60);
                currentTimeEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
                
                // Gapless Crossfade Trigger (4 seconds early)
                if (audio.currentTime >= audio.duration - 4) {
                    if (!window.player.state.isCrossfadingNext) {
                        window.player.state.isCrossfadingNext = true;
                        window.player.audio.nextSong(true);
                    }
                }
            }

            // --- LIRIK KARAOKE SYNC ---
            const { currentLyrics, currentLyricIndex } = window.player.state;
            if (currentLyrics && currentLyrics.length > 0) {
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
                    window.player.state.currentLyricIndex = activeIndex;
                    if (window.player.audio && window.player.audio.syncToMiniPlayer) {
                        window.player.audio.syncToMiniPlayer();
                    }
                }
            }
        });

        audio.addEventListener('loadedmetadata', () => {
            let m = Math.floor(audio.duration / 60), s = Math.floor(audio.duration % 60);
            durationEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
        });
        
        audio.addEventListener("play", () => { 
            ipcRenderer.send("player-state", true); 
            window.player.audio.syncToMiniPlayer(); 
        });
        
        audio.addEventListener("pause", () => { 
            ipcRenderer.send("player-state", false); 
            window.player.audio.syncToMiniPlayer(); 
        });
    }

    if (progressBar) {
        progressBar.addEventListener('input', () => { 
            audio.currentTime = (progressBar.value / 100) * audio.duration; 
        });
    }

    // 2. Volume listeners
    if (volumeIcon) volumeIcon.addEventListener('click', window.player.audio.toggleMute);
    if (volumeSlider) {
        volumeSlider.addEventListener('input', () => {
            const val = volumeSlider.value / 100;
            window.player.state.targetVolume = val;
            audio.volume = val;
            window.player.state.isMuted = val === 0; 
            if (volumeText) volumeText.innerText = `${volumeSlider.value}%`;
            window.player.audio.updateVolumeIcon(val);
        });
    }

    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            const currentMode = window.player.state.shuffleMode || (window.player.state.isShuffle ? 'normal' : 'off');
            if (currentMode === 'off') {
                window.player.state.shuffleMode = 'normal';
                window.player.state.isShuffle = true;
                shuffleBtn.style.color = 'var(--theme-glow)';
                shuffleBtn.style.textShadow = 'none';
                shuffleBtn.title = 'Shuffle Standar (1 Ketuk)';
                shuffleBtn.innerHTML = '<i class="fa-solid fa-shuffle"></i>';
            } else if (currentMode === 'normal') {
                window.player.state.shuffleMode = 'smart';
                window.player.state.isShuffle = true;
                shuffleBtn.style.color = '#f59e0b';
                shuffleBtn.style.textShadow = '0 0 10px #f59e0b';
                shuffleBtn.title = 'Smart Shuffle ✨ (Sensitif Vibe & Artis - 2 Ketuk)';
                shuffleBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
            } else {
                window.player.state.shuffleMode = 'off';
                window.player.state.isShuffle = false;
                shuffleBtn.style.color = '#aaa';
                shuffleBtn.style.textShadow = 'none';
                shuffleBtn.title = 'Shuffle Mati';
                shuffleBtn.innerHTML = '<i class="fa-solid fa-shuffle"></i>';
            }
        });
    }

    if (repeatBtn) {
        repeatBtn.addEventListener('click', () => {
            window.player.state.isRepeat = !window.player.state.isRepeat;
            repeatBtn.style.color = window.player.state.isRepeat ? 'var(--theme-glow)' : '#aaa';
        });
    }

    // 4. Popups & Lyrics toggle
    if (lyricsToggleBtn) lyricsToggleBtn.addEventListener('click', () => lyricsPopup.classList.add('show'));
    if (closeLyricsBtn) closeLyricsBtn.addEventListener('click', () => lyricsPopup.classList.remove('show'));

    if (playlistToggleBtn) playlistToggleBtn.addEventListener('click', () => playlistPopup.classList.add('show'));
    if (closePopupBtn) closePopupBtn.addEventListener('click', () => playlistPopup.classList.remove('show'));

    // Backdrop click handlers to dismiss popups on backdrop click
    const ytPopup = window.player.dom.ytPopup || document.getElementById('yt-popup');
    const confirmPopup = document.getElementById('confirm-popup');
    const createPlaylistPopup = document.getElementById('create-playlist-popup');
    const addToPlaylistPopup = document.getElementById('add-to-playlist-popup');
    
    [playlistPopup, lyricsPopup, ytPopup, confirmPopup, createPlaylistPopup, addToPlaylistPopup].forEach(popup => {
        if (popup) {
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    popup.classList.remove('show');
                }
            });
        }
    });

    // Custom Playlist Modal Controls
    const btnCreatePlaylist = document.getElementById('btn-create-playlist');
    const closeCreatePlaylistBtn = document.getElementById('close-create-playlist-btn');
    const savePlaylistBtn = document.getElementById('save-playlist-btn');
    const newPlaylistNameInput = document.getElementById('new-playlist-name');
    const closeAddToPlaylistBtn = document.getElementById('close-add-to-playlist-btn');

    if (btnCreatePlaylist && createPlaylistPopup) {
        btnCreatePlaylist.addEventListener('click', () => {
            if (newPlaylistNameInput) newPlaylistNameInput.value = '';
            createPlaylistPopup.classList.add('show');
        });
    }

    if (closeCreatePlaylistBtn && createPlaylistPopup) {
        closeCreatePlaylistBtn.addEventListener('click', () => {
            createPlaylistPopup.classList.remove('show');
        });
    }

    if (closeAddToPlaylistBtn && addToPlaylistPopup) {
        closeAddToPlaylistBtn.addEventListener('click', () => {
            addToPlaylistPopup.classList.remove('show');
        });
    }

    if (savePlaylistBtn && newPlaylistNameInput && createPlaylistPopup) {
        savePlaylistBtn.addEventListener('click', () => {
            const name = newPlaylistNameInput.value.trim();
            if (!name) return alert("Ketik nama playlist bang!");
            const created = window.player.playlistManager.createCustomPlaylist(name);
            if (created) {
                createPlaylistPopup.classList.remove('show');
                window.player.playlistManager.switchPlaylistTab('active_playlist', created.id);
            }
        });
    }

    // Mode tabs (Semua / Queue / Playlist)
    const btnModeAll = document.getElementById('btn-mode-all');
    const btnModeQueue = document.getElementById('btn-mode-queue');
    const btnModePlaylist = document.getElementById('btn-mode-playlist');
    
    if (btnModeAll) {
        btnModeAll.addEventListener('click', () => {
            window.player.playlistManager.switchPlaylistTab('all');
        });
    }
    if (btnModeQueue) {
        btnModeQueue.addEventListener('click', () => {
            window.player.playlistManager.switchPlaylistTab('active_playlist');
        });
    }
    if (btnModePlaylist) {
        btnModePlaylist.addEventListener('click', () => {
            window.player.playlistManager.switchPlaylistTab('playlist');
        });
    }

    // Settings Toggle
    const settingsBtn = document.getElementById("settings-btn");
    const settingsPanel = document.getElementById("settings-panel");
    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener("click", () => settingsPanel.classList.toggle("show"));
    }

    // Playlist Search Filter
    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        searchBar.addEventListener('input', () => {
            window.player.playlistManager.renderPlaylist();
        });
    }

    // Theme selector
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        const savedTheme = localStorage.getItem('njoy_theme') || 'default';
        themeSelector.value = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);

        themeSelector.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;
            document.body.setAttribute('data-theme', selectedTheme);
            localStorage.setItem('njoy_theme', selectedTheme);
            window.player.audio.syncToMiniPlayer();
        });
    }

    // Dropdown import menu
    if (addMenuBtn && addDropdown) {
        addMenuBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            addDropdown.classList.toggle('show'); 
        });
        document.addEventListener('click', () => { 
            if (addDropdown.classList.contains('show')) addDropdown.classList.remove('show'); 
        });
    }

    if (importFileBtn) {
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
                window.player.playlistManager.loadPlaylist();
            }
        });
    }

    if (importYtBtn) {
        importYtBtn.addEventListener('click', () => { 
            addDropdown.classList.remove('show'); 
            window.player.dom.ytPopup.classList.add('show'); 
            window.player.dom.ytUrlInput.focus(); 
        });
    }

    // Mini Player
    if (miniPlayerBtn) {
        miniPlayerBtn.addEventListener('click', () => { 
            window.player.state.isMiniMode = !window.player.state.isMiniMode; 
            ipcRenderer.send('toggle-mini-player', window.player.state.isMiniMode); 
        });
    }

    ipcRenderer.on('set-mini-mode', (_, isMini) => { 
        window.player.state.isMiniMode = isMini; 
    });
    
    ipcRenderer.on('request-state-for-mini', window.player.audio.syncToMiniPlayer);

    // Custom album cover upload
    if (uploadCoverBtn) {
        uploadCoverBtn.addEventListener('click', async () => {
            const { playlist, currentSongIndex } = window.player.state;
            if (playlist.length === 0) return;
            const currentSongName = path.parse(playlist[currentSongIndex]).name;
            const newCoverPath = await ipcRenderer.invoke('upload-custom-cover', currentSongName);
            if (newCoverPath) document.getElementById('album-art-img').src = `file://${newCoverPath}?t=${new Date().getTime()}`;
        });
        
        uploadCoverBtn.addEventListener('contextmenu', async (e) => {
            e.preventDefault(); 
            const { playlist, currentSongIndex } = window.player.state;
            if (playlist.length === 0) return;
            const currentSongName = path.parse(playlist[currentSongIndex]).name;
            const isRemoved = await ipcRenderer.invoke('remove-custom-cover', currentSongName);
            if (isRemoved) {
                window.player.playlistManager.extractMetadata(
                    path.join(songsFolder, playlist[currentSongIndex]), 
                    currentSongName
                );
            }
        });
    }

    // IPC system media listeners
    ipcRenderer.on("thumb-play", () => window.player.audio.togglePlay());
    ipcRenderer.on("thumb-next", () => window.player.audio.nextSong(false));
    ipcRenderer.on("thumb-prev", () => window.player.audio.prevSong(false));

    ipcRenderer.on('shortcut-mute', window.player.audio.toggleMute);
    ipcRenderer.on('shortcut-volume-up', () => window.player.audio.adjustVolume(0.05));
    ipcRenderer.on('shortcut-volume-down', () => window.player.audio.adjustVolume(-0.05));

    // Settings panel switch toggles
    const trayToggle = document.getElementById('tray-toggle');
    const notificationToggle = document.getElementById('notification-toggle');
    const ontopToggle = document.getElementById('ontop-toggle');

    if (trayToggle) {
        const savedTray = localStorage.getItem('njoy_tray');
        const trayEnabled = savedTray !== null ? savedTray === 'true' : true;
        trayToggle.checked = trayEnabled;
        ipcRenderer.send('toggle-tray', trayEnabled);
        
        trayToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('njoy_tray', enabled);
            ipcRenderer.send('toggle-tray', enabled);
        });
    }

    if (notificationToggle) {
        const savedNotification = localStorage.getItem('njoy_notification');
        const notificationEnabledSetting = savedNotification !== null ? savedNotification === 'true' : true;
        notificationToggle.checked = notificationEnabledSetting;
        ipcRenderer.send('toggle-notification', notificationEnabledSetting);
        
        notificationToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('njoy_notification', enabled);
            ipcRenderer.send('toggle-notification', enabled);
        });
    }

    const waveToggle = document.getElementById('wave-toggle');
    const waveCanvas = document.getElementById('audio-wave-canvas');
    if (waveToggle) {
        const savedWave = localStorage.getItem('njoy_wave');
        const waveEnabled = savedWave !== null ? savedWave === 'true' : true;
        waveToggle.checked = waveEnabled;
        if (waveCanvas) waveCanvas.style.display = waveEnabled ? 'block' : 'none';
        
        waveToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('njoy_wave', enabled);
            if (waveCanvas) waveCanvas.style.display = enabled ? 'block' : 'none';
        });
    }

    if (ontopToggle) {
        const savedOntop = localStorage.getItem('njoy_ontop');
        const ontopEnabled = savedOntop !== null ? savedOntop === 'true' : false;
        ontopToggle.checked = ontopEnabled;
        ipcRenderer.send('toggle-ontop', ontopEnabled);
        
        ontopToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('njoy_ontop', enabled);
            ipcRenderer.send('toggle-ontop', enabled);
        });
    }

    // 5. Download Manager UI toggles
    const titleDlBtn = document.getElementById('title-download-btn');
    const dlPopup = document.getElementById('download-manager-popup');
    const closeDlPopupBtn = document.getElementById('close-dl-popup-btn');

    if (titleDlBtn && dlPopup) {
        titleDlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dlPopup.classList.toggle('show');
        });
    }

    if (closeDlPopupBtn && dlPopup) {
        closeDlPopupBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dlPopup.classList.remove('show');
        });
    }

    // Close download manager popup when clicking outside
    document.addEventListener('click', (e) => {
        if (dlPopup && dlPopup.classList.contains('show')) {
            if (!dlPopup.contains(e.target) && e.target !== titleDlBtn && !titleDlBtn.contains(e.target)) {
                dlPopup.classList.remove('show');
            }
        }
    });

    // 6. IPC Download Metadata Update
    ipcRenderer.on('download-metadata', (event, { url, title }) => {
        const download = window.player.state.downloads.find(dl => dl.url === url);
        if (download) {
            download.title = title;
            window.player.downloadController.renderDownloadManager();
        }
    });

    // 7. Keyboard shortcuts local listeners (Focus)
    window.addEventListener('keydown', (e) => {
        if (document.activeElement && (
            document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' || 
            document.activeElement.tagName === 'SELECT'
        )) {
            if (e.key === 'Escape') {
                document.activeElement.blur();
            }
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            window.player.audio.adjustVolume(0.05);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            window.player.audio.adjustVolume(-0.05);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            window.player.audio.nextSong(false);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            window.player.audio.prevSong(false);
        } else if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            window.player.audio.togglePlay();
        }
    });
}

window.player.uiController = {
    initializeUiListeners
};

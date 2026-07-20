const { ipcRenderer } = require('electron');

function syncToMiniPlayer() {
    const { audio, songTitleEl, songArtistEl } = window.player.dom;
    const { currentLyrics, currentLyricIndex } = window.player.state;
    
    let activeLyric = '';
    if (currentLyrics && currentLyrics.length > 0) {
        if (currentLyricIndex >= 0 && currentLyricIndex < currentLyrics.length) {
            activeLyric = currentLyrics[currentLyricIndex].text;
        } else {
            activeLyric = 'Intro...';
        }
    }

    ipcRenderer.send('sync-mini-player', {
        title: songTitleEl ? songTitleEl.innerText : '',
        artist: songArtistEl ? songArtistEl.innerText : '',
        cover: document.getElementById('album-art-img') ? document.getElementById('album-art-img').src : '',
        isPlaying: audio ? !audio.paused : false,
        lyric: activeLyric,
        theme: document.body.getAttribute('data-theme') || 'default',
        themeGlow: getComputedStyle(document.documentElement).getPropertyValue('--theme-glow').trim(),
        themeBorder: getComputedStyle(document.documentElement).getPropertyValue('--theme-border').trim()
    });
}

function togglePlay() {
    const { playlist, currentMode, njoyList, currentSongIndex } = window.player.state;
    const { audio, playBtn } = window.player.dom;
    if (playlist.length === 0) return;
    
    if (currentMode === 'njoy') {
        if (njoyList.length === 0) return;
        // Jika lagu yang dimuat tidak ada dalam queue, muat lagu pertama di queue
        const currentSong = playlist[currentSongIndex];
        if (!njoyList.includes(currentSong)) {
            const firstQueueSong = njoyList[0];
            const idx = playlist.indexOf(firstQueueSong);
            if (idx !== -1) {
                window.player.playlistManager.loadSong(idx);
            }
        }
    }
    
    if (audio.paused) {
        audio.play().catch(err => console.log(err));
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        audio.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

function changeSongWithFade(newIndex) {
    const { playlist } = window.player.state;
    const { audio, playBtn, volumeSlider } = window.player.dom;
    if (playlist.length === 0) return;
    
    if (window.player.state.fadeOutInterval) clearInterval(window.player.state.fadeOutInterval);
    if (window.player.state.fadeInInterval) clearInterval(window.player.state.fadeInInterval);
    
    if (volumeSlider) window.player.state.targetVolume = volumeSlider.value / 100;
    
    let currentVol = audio.volume;
    window.player.state.fadeOutInterval = setInterval(() => {
        if (currentVol > 0.05) {
            currentVol -= 0.05; 
            audio.volume = Math.max(0, currentVol);
        } else {
            clearInterval(window.player.state.fadeOutInterval);
            window.player.state.fadeOutInterval = null;
            audio.pause();
            
            // Panggil loadSong dari playlistManager
            window.player.playlistManager.loadSong(newIndex);
            
            if (window.player.state.isMuted) {
                audio.volume = 0;
                audio.play().catch(e => console.log(e));
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                audio.volume = 0; 
                audio.play().catch(e => console.log(e));
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                window.player.state.fadeInInterval = setInterval(() => {
                    if (audio.volume < window.player.state.targetVolume - 0.05) {
                        audio.volume += 0.05; 
                    } else {
                        audio.volume = window.player.state.targetVolume;
                        clearInterval(window.player.state.fadeInInterval);
                        window.player.state.fadeInInterval = null;
                    }
                }, 40); 
            }
        }
    }, 30); 
}

function nextSong(isAutomatic = false) {
    const { playlist, currentSongIndex, isShuffle, isRepeat, unplayedShuffle, currentMode, njoyList } = window.player.state;
    const auto = isAutomatic === true;
    if (playlist.length === 0) return;
    
    // Hapus lagu saat ini dari queue jika dimainkan di mode queue, atau selesai diputar otomatis
    const currentSong = playlist[currentSongIndex];
    const queueIndex = njoyList.indexOf(currentSong);
    if (queueIndex !== -1 && (auto || currentMode === 'njoy')) {
        njoyList.splice(queueIndex, 1);
        localStorage.setItem('njoyList', JSON.stringify(njoyList));
        window.player.playlistManager.renderPlaylist();
    }
    
    if (currentMode === 'njoy') {
        if (njoyList.length > 0) {
            // Putar lagu pertama di antrean baru
            const nextIdx = playlist.indexOf(njoyList[0]);
            if (nextIdx !== -1) {
                changeSongWithFade(nextIdx);
            }
        } else {
            // Antrean habis, stop pemutaran
            const { audio, playBtn } = window.player.dom;
            if (audio) audio.pause();
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
        return;
    }
    
    // Logika Mode 'all' (Biasa)
    let nextIndex = currentSongIndex;
    if (auto && isRepeat) nextIndex = currentSongIndex;
    else if (isShuffle) {
        if (unplayedShuffle.length === 0) {
            for (let i = 0; i < playlist.length; i++) {
                if (i !== currentSongIndex) {
                    window.player.state.unplayedShuffle.push(i);
                }
            }
        }
        const updatedUnplayedShuffle = window.player.state.unplayedShuffle;
        if (updatedUnplayedShuffle.length > 0) {
            const randomBagIndex = Math.floor(Math.random() * updatedUnplayedShuffle.length);
            nextIndex = updatedUnplayedShuffle[randomBagIndex];
            window.player.state.unplayedShuffle.splice(randomBagIndex, 1);
        } else {
            nextIndex = currentSongIndex;
        }
    } else {
        nextIndex = (currentSongIndex + 1) % playlist.length;
    }
    changeSongWithFade(nextIndex); 
}

function prevSong(isAutomatic = false) {
    const { playlist, currentSongIndex, isShuffle, isRepeat, currentMode } = window.player.state;
    const auto = isAutomatic === true;
    if (playlist.length === 0) return;
    
    if (currentMode === 'njoy') {
        // Di mode queue, mengulang lagu dari awal karena tidak ada riwayat queue
        const { audio } = window.player.dom;
        if (audio) {
            audio.currentTime = 0;
            if (audio.paused) {
                audio.play().catch(e => console.log(e));
                const { playBtn } = window.player.dom;
                if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            }
        }
        return;
    }
    
    let prevIndex = currentSongIndex;
    if (auto && isRepeat) prevIndex = currentSongIndex;
    else if (isShuffle) {
        prevIndex = Math.floor(Math.random() * playlist.length);
    } else {
        prevIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    }
    changeSongWithFade(prevIndex);
}

function updateVolumeIcon(vol) {
    const { volumeIcon } = window.player.dom;
    if (!volumeIcon) return;
    if (vol === 0 || window.player.state.isMuted) volumeIcon.className = 'fa-solid fa-volume-xmark'; 
    else if (vol < 0.5) volumeIcon.className = 'fa-solid fa-volume-low'; 
    else volumeIcon.className = 'fa-solid fa-volume-high'; 
}

function adjustVolume(change) {
    const { audio, volumeSlider, volumeText } = window.player.dom;
    let newVol = Math.min(1, Math.max(0, audio.volume + change));
    newVol = Math.round(newVol * 100) / 100;
    audio.volume = newVol;
    window.player.state.targetVolume = newVol;
    window.player.state.isMuted = newVol === 0;
    if (volumeSlider) volumeSlider.value = Math.round(newVol * 100);
    if (volumeText) volumeText.innerText = `${Math.round(newVol * 100)}%`;
    updateVolumeIcon(newVol);
}

function toggleMute() {
    const { audio, volumeSlider, volumeText } = window.player.dom;
    const { isMuted, lastVolume } = window.player.state;
    if (isMuted) {
        window.player.state.isMuted = false;
        audio.volume = lastVolume > 0 ? lastVolume : 0.7; 
        if (volumeSlider) volumeSlider.value = audio.volume * 100;
    } else {
        window.player.state.lastVolume = audio.volume;
        window.player.state.isMuted = true;
        audio.volume = 0;
        if (volumeSlider) volumeSlider.value = 0;
    }
    if (volumeText) volumeText.innerText = `${Math.round(audio.volume * 100)}%`;
    updateVolumeIcon(audio.volume);
}

// Daftarkan ke Global Registry
window.player.audio = {
    syncToMiniPlayer,
    togglePlay,
    changeSongWithFade,
    nextSong,
    prevSong,
    updateVolumeIcon,
    adjustVolume,
    toggleMute
};

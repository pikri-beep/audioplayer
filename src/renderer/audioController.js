const { ipcRenderer } = require('electron');

function syncToMiniPlayer() {
    const { audio, songTitleEl, songArtistEl } = window.player.dom;
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
    const { playlist } = window.player.state;
    const { audio, playBtn } = window.player.dom;
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
    
    let nextIndex = currentSongIndex;
    if (auto && isRepeat) nextIndex = currentSongIndex;
    else if (isShuffle) {
        if (unplayedShuffle.length === 0) {
            for (let i = 0; i < playlist.length; i++) {
                if (i !== currentSongIndex) {
                    if (currentMode !== 'njoy' || njoyList.includes(playlist[i])) {
                        window.player.state.unplayedShuffle.push(i);
                    }
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
    const { playlist, currentSongIndex, isShuffle, isRepeat, currentMode, njoyList } = window.player.state;
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

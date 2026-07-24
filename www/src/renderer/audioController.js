const { ipcRenderer } = (typeof require !== 'undefined') ? require('electron') : { ipcRenderer: null };

async function fetchRelatedTracks(query) {
    if (typeof ipcRenderer !== 'undefined' && ipcRenderer) {
        return await ipcRenderer.invoke('get-related-tracks', query);
    } else {
        const response = await fetch(`/api/get-related-tracks?query=${encodeURIComponent(query)}`);
        return await response.json();
    }
}

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
    const { playlist, currentMode, njoyList, currentSongIndex, isStreamMode } = window.player.state;
    const { audio, playBtn } = window.player.dom;
    
    if (playlist.length === 0 && !isStreamMode && (!audio.src || audio.src === '')) return;
    
    if (!isStreamMode && currentMode === 'njoy') {
        if (njoyList.length === 0) return;
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

let fadingOutAudio = null;

function changeSongWithFade(newIndex) {
    const { playlist } = window.player.state;
    const { audio, playBtn, volumeSlider } = window.player.dom;
    window.player.state.isStreamMode = false;
    window.player.state.isCrossfadingNext = false; 
    if (playlist.length === 0) return;
    
    if (window.player.state.fadeInInterval) clearInterval(window.player.state.fadeInInterval);
    if (volumeSlider) window.player.state.targetVolume = volumeSlider.value / 100;
    
    if (!audio.paused && audio.src && audio.currentTime > 0) {
        if (fadingOutAudio) {
            fadingOutAudio.pause();
            fadingOutAudio.src = '';
        }
        try {
            fadingOutAudio = new Audio(audio.src);
            fadingOutAudio.currentTime = audio.currentTime;
            fadingOutAudio.volume = audio.volume;
            fadingOutAudio.play().catch(e => console.log(e));
            
            let fadeOutVol = fadingOutAudio.volume;
            const fadeOutInt = setInterval(() => {
                if (fadeOutVol > 0.05) {
                    fadeOutVol -= 0.05;
                    if(fadingOutAudio) fadingOutAudio.volume = Math.max(0, fadeOutVol);
                } else {
                    clearInterval(fadeOutInt);
                    if (fadingOutAudio) {
                        fadingOutAudio.pause();
                        fadingOutAudio.src = '';
                        fadingOutAudio = null;
                    }
                }
            }, 60); 
        } catch(e) { console.error(e); }
    }
    
    audio.pause();
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
        }, 50); 
    }
}

function getSmartShuffleNextIndex(playlist, currentSongIndex) {
    if (playlist.length <= 1) return 0;
    const currentSongName = playlist[currentSongIndex] || '';
    
    let currentArtist = '';
    if (currentSongName.includes('-')) {
        currentArtist = currentSongName.split('-')[0].trim().toLowerCase();
    }
    
    if (!window.player.state.playHistory) window.player.state.playHistory = [];
    if (!window.player.state.playHistory.includes(currentSongIndex)) {
        window.player.state.playHistory.push(currentSongIndex);
    }
    
    const maxHistory = Math.min(Math.floor(playlist.length / 2), 15);
    while (window.player.state.playHistory.length > maxHistory) {
        window.player.state.playHistory.shift();
    }
    
    const matchingIndices = [];
    playlist.forEach((song, idx) => {
        if (window.player.state.playHistory.includes(idx)) return;
        const lowerSong = song.toLowerCase();
        const currentLower = currentSongName.toLowerCase();
        
        let isMatch = false;
        if (currentArtist && lowerSong.includes(currentArtist)) isMatch = true;
        else if (lowerSong.includes('acoustic') && currentLower.includes('acoustic')) isMatch = true;
        else if (lowerSong.includes('cover') && currentLower.includes('cover')) isMatch = true;
        else if (lowerSong.includes('live') && currentLower.includes('live')) isMatch = true;
        else if (lowerSong.includes('remix') && currentLower.includes('remix')) isMatch = true;
        
        if (isMatch) matchingIndices.push(idx);
    });
    
    if (matchingIndices.length > 0) {
        return matchingIndices[Math.floor(Math.random() * matchingIndices.length)];
    }
    
    const unplayedIndices = [];
    for (let i = 0; i < playlist.length; i++) {
        if (!window.player.state.playHistory.includes(i)) unplayedIndices.push(i);
    }
    
    if (unplayedIndices.length > 0) {
        return unplayedIndices[Math.floor(Math.random() * unplayedIndices.length)];
    }
    
    window.player.state.playHistory = [currentSongIndex];
    let nextIdx = Math.floor(Math.random() * playlist.length);
    if (nextIdx === currentSongIndex && playlist.length > 1) nextIdx = (currentSongIndex + 1) % playlist.length;
    return nextIdx;
}

function nextSong(isAutomatic = false) {
    const { playlist, currentSongIndex, isRepeat, unplayedShuffle, currentMode, njoyList, isStreamMode, streamQueue, streamQueueIndex, currentStreamTrack } = window.player.state;
    const shuffleMode = window.player.state.shuffleMode || (window.player.state.isShuffle ? 'normal' : 'off');
    const auto = isAutomatic === true;

    // Handle Streaming Mode Playback
    if (isStreamMode) {
        if (!streamQueue || streamQueue.length === 0) return;
        
        let nextIdx = (streamQueueIndex !== undefined ? streamQueueIndex : 0) + 1;
        if (auto && isRepeat) {
            nextIdx = streamQueueIndex;
        } else if (shuffleMode === 'smart') {
            // Smart Shuffle ✨ for streaming: Fetch related tracks of current song artist/vibe
            const currentTitle = currentStreamTrack ? (currentStreamTrack.author + " " + currentStreamTrack.title) : "popular music";
            fetchRelatedTracks(currentTitle).then(related => {
                if (related && related.length > 0) {
                    window.player.state.streamQueue = related;
                    window.player.state.streamQueueIndex = 0;
                    if (window.player.downloadController && window.player.downloadController.playStreamSong) {
                        window.player.downloadController.playStreamSong(related[0], related);
                    }
                }
            });
            return;
        } else if (shuffleMode === 'normal') {
            if (!window.player.state.streamPlayHistory) window.player.state.streamPlayHistory = [];
            if (!window.player.state.streamPlayHistory.includes(streamQueueIndex)) {
                window.player.state.streamPlayHistory.push(streamQueueIndex);
            }
            const maxStreamHistory = Math.min(Math.floor(streamQueue.length / 2), 15);
            while (window.player.state.streamPlayHistory.length > maxStreamHistory) {
                window.player.state.streamPlayHistory.shift();
            }
            const unplayed = [];
            for (let i = 0; i < streamQueue.length; i++) {
                if (!window.player.state.streamPlayHistory.includes(i)) unplayed.push(i);
            }
            if (unplayed.length > 0) {
                nextIdx = unplayed[Math.floor(Math.random() * unplayed.length)];
            } else {
                window.player.state.streamPlayHistory = [streamQueueIndex];
                nextIdx = Math.floor(Math.random() * streamQueue.length);
            }
        }
        
        if (nextIdx < streamQueue.length) {
            window.player.state.streamQueueIndex = nextIdx;
            const nextTrack = streamQueue[nextIdx];
            if (window.player.downloadController && window.player.downloadController.playStreamSong) {
                window.player.downloadController.playStreamSong(nextTrack, streamQueue);
            }
        } else {
            // Infinite Radio / Autoplay Related Tracks
            const currentTitle = currentStreamTrack ? currentStreamTrack.title : "popular music";
            fetchRelatedTracks(currentTitle).then(related => {
                if (related && related.length > 0) {
                    window.player.state.streamQueue = related;
                    window.player.state.streamQueueIndex = 0;
                    if (window.player.downloadController && window.player.downloadController.playStreamSong) {
                        window.player.downloadController.playStreamSong(related[0], related);
                    }
                }
            });
        }
        return;
    }

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
            const nextIdx = playlist.indexOf(njoyList[0]);
            if (nextIdx !== -1) {
                changeSongWithFade(nextIdx);
            }
        } else {
            const { audio, playBtn } = window.player.dom;
            if (audio) audio.pause();
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
        return;
    }
    
    // Logika Mode 'all' (Biasa)
    let nextIndex = currentSongIndex;
    if (auto && isRepeat) nextIndex = currentSongIndex;
    else if (shuffleMode === 'smart') {
        nextIndex = getSmartShuffleNextIndex(playlist, currentSongIndex);
    } else if (shuffleMode === 'normal') {
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

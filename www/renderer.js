window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Renderer Unhandled Rejection]', event.reason);
});

const fs = require('fs');
const { ipcRenderer } = require('electron');
const path = require('path');

// 1. Inisialisasi Registry Global `window.player`
window.player = {
    // Kumpulan Variabel DOM
    dom: {
        audio: document.getElementById('audio-element'),
        playBtn: document.getElementById('play-btn'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        shuffleBtn: document.getElementById('shuffle-btn'),
        repeatBtn: document.getElementById('repeat-btn'),
        miniPlayerBtn: document.getElementById('mini-player-btn'),
        progressBar: document.getElementById('progress-bar'),
        currentTimeEl: document.getElementById('current-time'),
        durationEl: document.getElementById('duration'),
        songTitleEl: document.getElementById('song-title'),
        songArtistEl: document.getElementById('song-artist'),
        playlistUl: document.getElementById('playlist-ul'),
        playlistPopup: document.getElementById('playlist-popup'),
        playlistToggleBtn: document.getElementById('playlist-toggle-btn'),
        closePopupBtn: document.getElementById('close-popup-btn'),
        addMenuBtn: document.getElementById('add-menu-btn'),
        addDropdown: document.getElementById('add-dropdown'),
        importFileBtn: document.getElementById('import-file-btn'),
        importYtBtn: document.getElementById('import-yt-btn'),
        volumeSlider: document.getElementById('volume-slider'),
        volumeText: document.getElementById('volume-text'),
        volumeIcon: document.getElementById('volume-icon'),
        
        // UI YOUTUBE
        ytPopup: document.getElementById('yt-popup'),
        closeYtBtn: document.getElementById('close-yt-btn'),
        startYtDlBtn: document.getElementById('start-yt-dl-btn'),
        ytStatusText: document.getElementById('yt-status-text'),
        ytUrlInput: document.getElementById('yt-url-input'),
        ytSearchResults: document.getElementById('yt-search-results'),
        ytDownloadBtn: document.getElementById('yt-download-btn'), 
        
        // UI LIRIK
        lyricsPopup: document.getElementById('lyrics-popup'),
        closeLyricsBtn: document.getElementById('close-lyrics-btn'),
        lyricsToggleBtn: document.getElementById('lyrics-toggle-btn'),
        lyricsContainer: document.getElementById('lyrics-content'),
        uploadCoverBtn: document.getElementById('upload-cover-btn')
    },

    // Kumpulan State Variable
    state: {
        songsFolder: path.join(__dirname, 'songs'),
        playlist: [],
        currentSongIndex: 0,
        isShuffle: false,
        shuffleMode: 'off',
        isRepeat: false,
        isMiniMode: false,
        unplayedShuffle: [],
        njoyList: JSON.parse(localStorage.getItem('njoyList')) || [],
        currentMode: 'all',
        currentLyrics: [],
        currentLyricIndex: -1,
        targetVolume: 0.7, 
        lastVolume: 0.7, 
        isMuted: false,
        fadeOutInterval: null,
        fadeInInterval: null,
        lyricsFetchCount: 0,
        searchResults: [],
        searchCurrentPage: 1,
        searchResultsPerPage: 5,
        downloads: [],
        isStreamMode: false,
        streamQueue: [],
        streamQueueIndex: 0,
        currentStreamTrack: null,
        prefetchedNextStream: null,
        isCrossfadingNext: false
    }
};

// Set volume awal agar sinkron dengan UI slider
window.player.dom.audio.volume = window.player.state.targetVolume;

// Pre-fetching stream URL 10 detik sebelum lagu selesai
window.player.dom.audio.addEventListener('timeupdate', () => {
    const { audio } = window.player.dom;
    const { isStreamMode, streamQueue, streamQueueIndex, prefetchedNextStream } = window.player.state;
    
    if (isStreamMode && audio && audio.duration > 0) {
        const remainingTime = audio.duration - audio.currentTime;
        if (remainingTime <= 10 && remainingTime > 1 && !prefetchedNextStream) {
            const nextIdx = streamQueueIndex + 1;
            if (streamQueue && nextIdx < streamQueue.length) {
                const nextTrack = streamQueue[nextIdx];
                window.player.state.prefetchedNextStream = "fetching";
                console.log(`\n⚡ [NJOY Pre-fetch] Background pre-fetching stream URL untuk lagu berikutnya: "${nextTrack.title}"`);
                ipcRenderer.invoke('get-stream-url', nextTrack.url).then(res => {
                    if (res && res.success) {
                        window.player.state.prefetchedNextStream = res.streamUrl;
                        console.log(`✅ [NJOY Pre-fetch Success] Stream URL lagu berikutnya sudah siap di memori!`);
                    }
                }).catch(() => {
                    window.player.state.prefetchedNextStream = null;
                });
            }
        }
    }
});

// 2. Load Submodul Renderer
require('./src/renderer/playlistManager');
require('./src/renderer/audioController');
require('./src/renderer/lyricsService');
require('./src/renderer/downloadController');
require('./src/renderer/audioVisualizer');
require('./src/renderer/mediaSessionController');
require('./src/renderer/uiController');

// 3. Inisialisasi UI Event Listeners & Load Playlist Awal
window.player.downloadController.initializeDownloadListeners();
window.player.uiController.initializeUiListeners();

// Load Playlist awal
window.player.playlistManager.loadPlaylist(true);

// 4. Custom Window Controls kustom
document.getElementById('win-min').addEventListener('click', () => {
    ipcRenderer.send('window-minimize');
});
document.getElementById('win-max').addEventListener('click', () => {
    ipcRenderer.send('window-maximize');
});
document.getElementById('win-close').addEventListener('click', () => {
    ipcRenderer.send('window-close');
});
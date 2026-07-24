const { ipcRenderer } = require('electron');

function handleDownloadResult(result) {
    const { ytStatusText, ytPopup, ytUrlInput } = window.player.dom;
    if (result.success) {
        ytStatusText.innerHTML = '<i class="fa-solid fa-check" style="color: #00ff00;"></i> Berhasil! Menambahkan ke playlist...';
        setTimeout(() => {
            ytPopup.classList.remove('show');
            ytStatusText.style.display = 'none';
            ytUrlInput.value = '';
            window.player.playlistManager.loadPlaylist();
        }, 2000);
    } else {
        ytStatusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: red;"></i> Gagal! Cek koneksi internet/terminal.';
    }
}

function renderSearchResultsPage() {
    const { ytSearchResults } = window.player.dom;
    const { searchResults, searchCurrentPage, searchResultsPerPage } = window.player.state;
    
    ytSearchResults.innerHTML = '';
    
    const startIndex = (searchCurrentPage - 1) * searchResultsPerPage;
    const endIndex = Math.min(startIndex + searchResultsPerPage, searchResults.length);
    const pageItems = searchResults.slice(startIndex, endIndex);
    
    pageItems.forEach((video, itemIdx) => {
        const li = document.createElement('li');
        li.className = 'yt-search-item';
        li.innerHTML = `
            <div class="yt-search-thumb-container">
                <img src="${video.thumbnail}" class="yt-search-thumb">
                <span class="yt-search-duration">${video.timestamp}</span>
            </div>
            <div class="yt-search-info">
                <div class="yt-search-title">${video.title}</div>
                <div class="yt-search-author">${video.author}</div>
            </div>
            <div style="display: flex; gap: 6px;">
                <button class="yt-search-stream-btn" title="Putar Stream (0 Bytes Storage)" style="background: var(--theme-glow); border: none; color: #fff; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-play"></i> Stream
                </button>
                <button class="yt-search-dl-btn" title="Unduh File MP3">
                    <i class="fa-solid fa-arrow-down-long"></i>
                </button>
            </div>
        `;
        
        const handleStream = (e) => {
            e.stopPropagation();
            playStreamSong(video, pageItems);
        };

        const handleDownload = (e) => {
            e.stopPropagation();
            
            const downloadId = `dl-${Date.now()}`;
            const newDownload = {
                id: downloadId,
                url: video.url,
                title: video.title,
                status: 'downloading'
            };
            
            window.player.state.downloads.push(newDownload);
            updateDownloadBadge();
            renderDownloadManager();
            
            // Buka popup download manager
            const dlPopup = document.getElementById('download-manager-popup');
            if (dlPopup) dlPopup.classList.add('show');
            
            // Jalankan download secara asinkron (non-blocking)
            ipcRenderer.invoke('download-yt', video.url).then(result => {
                if (result.success) {
                    newDownload.status = 'success';
                    window.player.playlistManager.loadPlaylist(); // Reload playlist
                } else {
                    newDownload.status = 'failed';
                }
                renderDownloadManager();
                updateDownloadBadge();
            }).catch(err => {
                newDownload.status = 'failed';
                renderDownloadManager();
                updateDownloadBadge();
            });
        };
        
        li.addEventListener('click', handleStream);
        const streamBtn = li.querySelector('.yt-search-stream-btn');
        if (streamBtn) streamBtn.addEventListener('click', handleStream);
        const dlBtn = li.querySelector('.yt-search-dl-btn');
        if (dlBtn) dlBtn.addEventListener('click', handleDownload);
        
        ytSearchResults.appendChild(li);
    });
    
    updatePaginationControls();
}

async function playStreamSong(videoItem, queueList = []) {
    const { audio, songTitleEl, songArtistEl, playBtn } = window.player.dom;
    const albumArtImg = document.getElementById('album-art-img');
    const ytPopup = window.player.dom.ytPopup || document.getElementById('yt-popup');
    if (ytPopup) ytPopup.classList.remove('show');
    
    if (queueList && queueList.length > 0) {
        window.player.state.streamQueue = queueList;
        window.player.state.streamQueueIndex = queueList.findIndex(v => v.url === videoItem.url);
        if (window.player.state.streamQueueIndex === -1) window.player.state.streamQueueIndex = 0;
    }
    
    window.player.state.currentStreamTrack = videoItem;
    window.player.state.isStreamMode = true;
    window.player.state.prefetchedNextStream = null;

    if (songTitleEl) songTitleEl.innerText = "Memuat Stream...";
    if (songArtistEl) songArtistEl.innerText = videoItem.author || videoItem.title;
    if (albumArtImg) albumArtImg.src = videoItem.thumbnail || "assets/logo.png";
    if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    try {
        let streamUrlToPlay = null;
        if (window.player.state.prefetchedNextStream && typeof window.player.state.prefetchedNextStream === 'string' && window.player.state.prefetchedNextStream.startsWith('http')) {
            streamUrlToPlay = window.player.state.prefetchedNextStream;
            window.player.state.prefetchedNextStream = null;
            console.log(`⚡ [NJOY Instant Stream] Using pre-fetched stream URL for instant playback!`);
        } else {
            let result = null;
            if (typeof ipcRenderer !== 'undefined' && ipcRenderer) {
                result = await ipcRenderer.invoke('get-stream-url', videoItem.url);
            } else {
                // Fallback Android HTTP API Server
                const response = await fetch(`/api/get-stream-url?url=${encodeURIComponent(videoItem.url)}`);
                result = await response.json();
            }
            if (result && result.success && result.streamUrl) {
                streamUrlToPlay = result.streamUrl;
            }
        }

        if (streamUrlToPlay) {
            window.player.state.isCrossfadingNext = false;
            if (window.player.mediaSession && window.player.mediaSession.updateMediaSessionMetadata) {
                window.player.mediaSession.updateMediaSessionMetadata(videoItem.title, videoItem.author, videoItem.thumbnail);
            }
            
            // Ephemeral Background Clone for Crossfade Overlap
            if (!audio.paused && audio.src && audio.currentTime > 0) {
                try {
                    let clone = new Audio(audio.src);
                    clone.currentTime = audio.currentTime;
                    clone.volume = audio.volume;
                    clone.play().catch(e => console.log(e));
                    let vol = clone.volume;
                    const fadeInt = setInterval(() => {
                        if (vol > 0.05) {
                            vol -= 0.05;
                            clone.volume = Math.max(0, vol);
                        } else {
                            clearInterval(fadeInt);
                            clone.pause();
                            clone.src = '';
                            clone = null;
                        }
                    }, 60);
                } catch(e) {}
            }

            audio.pause();
            audio.src = streamUrlToPlay;
            audio.volume = 0; // Fade In preparation
            audio.play().then(() => {
                if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                if (songTitleEl) songTitleEl.innerText = videoItem.title;
                if (songArtistEl) songArtistEl.innerText = videoItem.author || "YouTube Stream";
                
                // Fade In Execution
                let fadeInVol = 0;
                const targetVol = window.player.state.targetVolume || 0.7;
                const inInt = setInterval(() => {
                    if (fadeInVol < targetVol - 0.05) {
                        fadeInVol += 0.05;
                        audio.volume = fadeInVol;
                    } else {
                        audio.volume = targetVol;
                        clearInterval(inInt);
                    }
                }, 50);
            }).catch(err => console.error("Stream play error:", err));
        } else {
            if (songTitleEl) songTitleEl.innerText = "Gagal memuat stream";
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    } catch (e) {
        console.error("Gagal streaming lagu:", e);
        if (songTitleEl) songTitleEl.innerText = "Gagal memuat stream";
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

function updatePaginationControls() {
    const { searchResults, searchCurrentPage, searchResultsPerPage } = window.player.state;
    const totalPages = Math.ceil(searchResults.length / searchResultsPerPage);
    
    const paginationContainer = document.getElementById('yt-pagination');
    const pageInfo = document.getElementById('yt-page-info');
    const prevBtn = document.getElementById('yt-prev-page-btn');
    const nextBtn = document.getElementById('yt-next-page-btn');
    
    if (searchResults.length > 0) {
        paginationContainer.style.display = 'flex';
        pageInfo.innerText = `Halaman ${searchCurrentPage} dari ${totalPages}`;
        
        prevBtn.disabled = searchCurrentPage === 1;
        nextBtn.disabled = searchCurrentPage === totalPages;
        
        prevBtn.style.opacity = prevBtn.disabled ? '0.4' : '1';
        prevBtn.style.cursor = prevBtn.disabled ? 'not-allowed' : 'pointer';
        nextBtn.style.opacity = nextBtn.disabled ? '0.4' : '1';
        nextBtn.style.cursor = nextBtn.disabled ? 'not-allowed' : 'pointer';
    } else {
        paginationContainer.style.display = 'none';
    }
}

function initializeDownloadListeners() {
    const { importYtBtn, ytDownloadBtn, ytPopup, closeYtBtn, ytSearchResults, ytStatusText, startYtDlBtn, ytUrlInput } = window.player.dom;
    
    const openYtBtn = importYtBtn || ytDownloadBtn;
    if (openYtBtn) {
        openYtBtn.addEventListener('click', () => { 
            const addDropdown = document.getElementById('add-dropdown');
            if (addDropdown) addDropdown.classList.remove('show');
            ytPopup.classList.add('show'); 
        });
    }
    
    if (closeYtBtn) {
        closeYtBtn.addEventListener('click', () => { 
            ytPopup.classList.remove('show'); 
            ytSearchResults.innerHTML = ''; 
            document.getElementById('yt-pagination').style.display = 'none';
            ytStatusText.style.display = 'none'; 
            window.player.state.searchResults = [];
            window.player.state.searchCurrentPage = 1;
        });
    }

    if (startYtDlBtn) {
        startYtDlBtn.addEventListener('click', async () => {
            const query = ytUrlInput.value.trim();
            if (!query) return alert("Ketik judul lagu atau paste link bang!");

            const isSpotify = /open\.spotify\.com/i.test(query);
            const isYouTube = /(youtube\.com|youtu\.be)/i.test(query);

            if (isSpotify || isYouTube) {
                const downloadId = `dl-${Date.now()}`;
                const newDownload = {
                    id: downloadId,
                    url: query,
                    title: isSpotify ? "Spotify Link" : "YouTube Link",
                    status: 'downloading'
                };
                
                window.player.state.downloads.push(newDownload);
                updateDownloadBadge();
                renderDownloadManager();
                
                ytUrlInput.value = '';
                const dlPopup = document.getElementById('download-manager-popup');
                if (dlPopup) dlPopup.classList.add('show');
                
                const ipcChannel = isSpotify ? 'download-spotify' : 'download-yt';
                ipcRenderer.invoke(ipcChannel, query).then(result => {
                    if (result.success) {
                        newDownload.status = 'success';
                        window.player.playlistManager.loadPlaylist();
                    } else {
                        newDownload.status = 'failed';
                    }
                    renderDownloadManager();
                    updateDownloadBadge();
                }).catch(err => {
                    newDownload.status = 'failed';
                    renderDownloadManager();
                    updateDownloadBadge();
                });
            } else {
                ytSearchResults.innerHTML = '';
                document.getElementById('yt-pagination').style.display = 'none';
                let results = [];
                if (typeof ipcRenderer !== 'undefined' && ipcRenderer) {
                    results = await ipcRenderer.invoke('search-yt', query);
                } else {
                    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                    results = await response.json();
                }
                ytStatusText.style.display = 'none';

                if (results.length === 0) {
                    ytStatusText.style.display = 'block';
                    ytStatusText.innerHTML = 'Lagu tidak ditemukan!';
                    return;
                }

                window.player.state.searchResults = results;
                window.player.state.searchCurrentPage = 1;
                renderSearchResultsPage();
            }
        });
    }
    
    // Pagination button listeners
    const prevPageBtn = document.getElementById('yt-prev-page-btn');
    const nextPageBtn = document.getElementById('yt-next-page-btn');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (window.player.state.searchCurrentPage > 1) {
                window.player.state.searchCurrentPage--;
                renderSearchResultsPage();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(window.player.state.searchResults.length / window.player.state.searchResultsPerPage);
            if (window.player.state.searchCurrentPage < totalPages) {
                window.player.state.searchCurrentPage++;
                renderSearchResultsPage();
            }
        });
    }
}

function renderDownloadManager() {
    const container = document.getElementById('download-list-container');
    if (!container) return;
    
    const { downloads } = window.player.state;
    if (downloads.length === 0) {
        container.innerHTML = '<div class="dl-empty-msg">Tidak ada unduhan aktif</div>';
        return;
    }
    
    container.innerHTML = '';
    downloads.forEach(dl => {
        const div = document.createElement('div');
        div.className = 'dl-item';
        
        let statusHtml = '';
        if (dl.status === 'downloading') {
            statusHtml = `<span class="dl-item-status"><i class="fa-solid fa-circle-notch fa-spin"></i> Mendownload...</span>`;
        } else if (dl.status === 'success') {
            statusHtml = `<span class="dl-item-status success"><i class="fa-solid fa-check"></i> Selesai</span>`;
        } else {
            statusHtml = `<span class="dl-item-status failed"><i class="fa-solid fa-xmark"></i> Gagal</span>`;
        }
        
        div.innerHTML = `
            <div class="dl-item-info">
                <div class="dl-item-title" title="${dl.title}">${dl.title}</div>
                ${statusHtml}
            </div>
        `;
        container.appendChild(div);
    });
}

function updateDownloadBadge() {
    const badge = document.getElementById('download-badge');
    if (!badge) return;
    
    const activeCount = window.player.state.downloads.filter(dl => dl.status === 'downloading').length;
    if (activeCount > 0) {
        badge.innerText = activeCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Daftarkan ke Global Registry
window.player.downloadController = {
    handleDownloadResult,
    renderSearchResultsPage,
    updatePaginationControls,
    initializeDownloadListeners,
    renderDownloadManager,
    updateDownloadBadge,
    playStreamSong
};

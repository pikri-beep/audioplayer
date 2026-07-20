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
    
    pageItems.forEach(video => {
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
            <button class="yt-search-dl-btn" title="Unduh Lagu">
                <i class="fa-solid fa-arrow-down-long"></i>
            </button>
        `;
        
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
        
        li.addEventListener('click', handleDownload);
        const dlBtn = li.querySelector('.yt-search-dl-btn');
        if (dlBtn) dlBtn.addEventListener('click', handleDownload);
        
        ytSearchResults.appendChild(li);
    });
    
    updatePaginationControls();
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
    const { ytDownloadBtn, ytPopup, closeYtBtn, ytSearchResults, ytStatusText, startYtDlBtn, ytUrlInput } = window.player.dom;
    
    if (ytDownloadBtn) {
        ytDownloadBtn.addEventListener('click', () => { 
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
                ytStatusText.style.display = 'block';
                ytStatusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Mencari...';
                
                const results = await ipcRenderer.invoke('search-yt', query);
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
    updateDownloadBadge
};

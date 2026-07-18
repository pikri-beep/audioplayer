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
        
        const handleDownload = async (e) => {
            e.stopPropagation();
            const { ytStatusText } = window.player.dom;
            ytSearchResults.innerHTML = '';
            document.getElementById('yt-pagination').style.display = 'none';
            ytStatusText.style.display = 'block';
            ytStatusText.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Mendownload <b>${video.title}</b>...`;
            const result = await ipcRenderer.invoke('download-yt', video.url);
            handleDownloadResult(result);
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

            ytSearchResults.innerHTML = '';
            document.getElementById('yt-pagination').style.display = 'none';
            ytStatusText.style.display = 'block';

            const isSpotify = /open\.spotify\.com/i.test(query);
            const isYouTube = /(youtube\.com|youtu\.be)/i.test(query);

            if (isSpotify) {
                ytStatusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Mengekstraksi dari Spotify...';
                const result = await ipcRenderer.invoke('download-spotify', query);
                handleDownloadResult(result);
            } else if (isYouTube) {
                ytStatusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Mendownload dari YouTube...';
                const result = await ipcRenderer.invoke('download-yt', query);
                handleDownloadResult(result);
            } else {
                ytStatusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Mencari...';
                const results = await ipcRenderer.invoke('search-yt', query);
                ytStatusText.style.display = 'none';

                if (results.length === 0) {
                    ytStatusText.style.display = 'block';
                    ytStatusText.innerHTML = 'Lagu tidak ditemukan!';
                    return;
                }

                // Simpan ke state
                window.player.state.searchResults = results;
                window.player.state.searchCurrentPage = 1;
                
                // Render halaman pertama
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

// Daftarkan ke Global Registry
window.player.downloadController = {
    handleDownloadResult,
    renderSearchResultsPage,
    updatePaginationControls,
    initializeDownloadListeners
};

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
            ytStatusText.style.display = 'none'; 
        });
    }

    if (startYtDlBtn) {
        startYtDlBtn.addEventListener('click', async () => {
            const query = ytUrlInput.value.trim();
            if (!query) return alert("Ketik judul lagu atau paste link bang!");

            ytSearchResults.innerHTML = '';
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

                results.forEach(video => {
                    const li = document.createElement('li');
                    li.style.cssText = `display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; cursor: pointer; margin-bottom: 5px;`;
                    li.innerHTML = `<img src="${video.thumbnail}" style="width: 50px; border-radius: 4px;"> <span>${video.title}</span>`;
                    
                    li.addEventListener('click', async () => {
                        ytSearchResults.innerHTML = '';
                        ytStatusText.style.display = 'block';
                        ytStatusText.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Mendownload <b>${video.title}</b>...`;
                        const result = await ipcRenderer.invoke('download-yt', video.url);
                        handleDownloadResult(result);
                    });
                    ytSearchResults.appendChild(li);
                });
            }
        });
    }
}

// Daftarkan ke Global Registry
window.player.downloadController = {
    handleDownloadResult,
    initializeDownloadListeners
};

function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const lyrics = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for (let line of lines) {
        const match = timeRegex.exec(line);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = parseInt(match[3], 10) * (match[3].length === 2 ? 10 : 1);
            const time = minutes * 60 + seconds + milliseconds / 1000;
            const text = line.replace(timeRegex, '').trim();
            if (text) lyrics.push({ time, text });
        }
    }
    return lyrics;
}

async function fetchLyrics(artist, title) {
    const { lyricsContainer, audio } = window.player.dom;
    if (!lyricsContainer) return;
    
    window.player.state.lyricsFetchCount++;
    const thisFetchId = window.player.state.lyricsFetchCount;

    lyricsContainer.innerHTML = '<p class="lyric-placeholder" style="color: #aaa; margin-top: 50px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Mencari lirik...</p>';
    window.player.state.currentLyrics = [];
    window.player.state.currentLyricIndex = -1;
    
    try {
        const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
        let query = cleanTitle;
        if (artist && artist !== "Unknown Artist") {
            query = artist + ' ' + cleanTitle;
        }
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (thisFetchId !== window.player.state.lyricsFetchCount) return;
        
        if (data && data.length > 0) {
            const synced = data.find(track => track.syncedLyrics);
            if (synced) {
                window.player.state.currentLyrics = parseLRC(synced.syncedLyrics);
                lyricsContainer.innerHTML = '';
                window.player.state.currentLyrics.forEach((line, index) => {
                    const p = document.createElement('p');
                    p.className = 'lyric-line';
                    p.id = `lyric-${index}`;
                    p.innerText = line.text;
                    p.addEventListener('click', () => { audio.currentTime = line.time; });
                    lyricsContainer.appendChild(p);
                });
                if (window.player.audio && window.player.audio.syncToMiniPlayer) {
                    window.player.audio.syncToMiniPlayer();
                }
                return;
            }
        }
        lyricsContainer.innerHTML = '<p class="lyric-placeholder" style="color: #aaa; margin-top: 50px;">Lirik karaoke tidak ditemukan 🥲</p>';
    } catch (err) {
        if (thisFetchId !== window.player.state.lyricsFetchCount) return;
        lyricsContainer.innerHTML = '<p class="lyric-placeholder" style="color: red; margin-top: 50px;">Gagal memuat lirik (Cek koneksi).</p>';
    }
}

// Daftarkan ke Global Registry
window.player.lyrics = {
    parseLRC,
    fetchLyrics
};

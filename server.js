if (typeof globalThis.File === 'undefined') {
    const { Blob } = require('buffer');
    globalThis.File = class File extends Blob {
        constructor(fileBits, fileName, options = {}) {
            super(fileBits, options);
            this.name = fileName;
            this.lastModified = options.lastModified || Date.now();
        }
    };
}

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const ytSearch = require('yt-search');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 1. Endpoint Stream URL (Ultra-Fast yt-dlp)
app.get('/api/get-stream-url', (req, res) => {
    const urlOrId = req.query.url;
    if (!urlOrId) {
        return res.status(400).json({ success: false, error: 'Parameter url diperlukan' });
    }

    const targetUrl = urlOrId.startsWith('http') ? urlOrId : `https://www.youtube.com/watch?v=${urlOrId}`;
    console.log(`\n⚡ [Android Stream Server] Extracting stream URL for: ${targetUrl}`);
    const command = `chcp 65001 > nul && yt-dlp -g -f "ba[ext=m4a]/ba[ext=webm]/ba/b" --no-playlist --geo-bypass --socket-timeout 5 --no-warning "${targetUrl}"`;

    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
        if (error || !stdout.trim()) {
            console.warn("⚠️ [Android Stream Server Retry] Fast format fail, trying standard bestaudio...");
            const fallbackCmd = `chcp 65001 > nul && yt-dlp -g -f bestaudio/best --no-warnings "${targetUrl}"`;
            exec(fallbackCmd, { maxBuffer: 1024 * 1024 * 10 }, (err2, stdout2) => {
                if (err2 || !stdout2.trim()) {
                    return res.json({ success: false, error: 'Stream URL tidak ditemukan' });
                }
                const streamUrl = stdout2.trim().split('\n')[0].trim();
                return res.json({ success: true, streamUrl });
            });
            return;
        }
        const streamUrl = stdout.trim().split('\n')[0].trim();
        console.log(`✅ [Android Stream Server Success] Stream URL: ${streamUrl.substring(0, 50)}...`);
        return res.json({ success: true, streamUrl });
    });
});

// 2. Endpoint Related Tracks (Autoplay / Radio)
app.get('/api/get-related-tracks', async (req, res) => {
    const query = req.query.query || 'popular music';
    try {
        console.log(`📻 [Android Server Autoplay] Searching related: "${query}"`);
        const searchResults = await ytSearch({ query: `${query} song audio` });
        if (!searchResults || !searchResults.videos || searchResults.videos.length === 0) {
            return res.json([]);
        }
        const mapped = searchResults.videos.slice(0, 10).map(v => ({
            id: v.videoId,
            url: v.url,
            title: v.title,
            author: v.author ? v.author.name : 'Unknown Artist',
            duration: v.timestamp,
            thumbnail: v.thumbnail
        }));
        return res.json(mapped);
    } catch (e) {
        return res.json([]);
    }
});

// 3. Endpoint Search Songs
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    try {
        const searchResults = await ytSearch(query);
        const mapped = (searchResults.videos || []).slice(0, 15).map(v => ({
            id: v.videoId,
            url: v.url,
            title: v.title,
            author: v.author ? v.author.name : 'Unknown Artist',
            duration: v.timestamp,
            thumbnail: v.thumbnail
        }));
        return res.json(mapped);
    } catch (e) {
        return res.json([]);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 [Audio Player Android Backend] Server aktif di http://localhost:${PORT}`);
    console.log(`📱 Siap melayani klien Android WebView & Web Browser.`);
});

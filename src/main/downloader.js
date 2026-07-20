const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const ytSearch = require('yt-search');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => { reject(err); });
    });
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                file.close();
                fs.unlink(destPath, () => {});
                reject(new Error(`Failed to download: status ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            file.close();
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

function cleanSearchTerm(term) {
    if (!term) return '';
    return term
        .replace(/\(Official\s+Video\)/gi, '')
        .replace(/\[Official\s+Video\]/gi, '')
        .replace(/\(Official\s+Audio\)/gi, '')
        .replace(/\[Official\s+Audio\]/gi, '')
        .replace(/\(Lyric\s+Video\)/gi, '')
        .replace(/\[Lyric\s+Video\]/gi, '')
        .replace(/\(MV\)/gi, '')
        .replace(/\[MV\]/gi, '')
        .replace(/\(Official\)/gi, '')
        .replace(/\[Official\]/gi, '')
        .replace(/\(Audio\)/gi, '')
        .replace(/\[Audio\]/gi, '')
        .replace(/HD/gi, '')
        .replace(/4K/gi, '')
        .replace(/\b(feat|ft)\b.*?$/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function registerDownloaderHandlers() {
    // 1. Fungsi Pencarian YouTube
    ipcMain.handle('search-yt', async (event, query) => {
        try {
            console.log(`\n🔍 [NJOY Search] Mencari di YouTube untuk: "${query}"`);
            const r = await ytSearch({ query: query });
            
            if (!r || !r.videos || r.videos.length === 0) {
                console.warn("⚠️ [NJOY Search] Hasil pencarian kosong dari YouTube.");
                return [];
            }

            const videos = r.videos.slice(0, 15); 
            return videos.map(v => {
                const thumbnailSrc = v.image || v.thumbnail || "assets/logo.png";
                const channelName = (v.author && v.author.name) ? v.author.name : "Unknown Channel";
                
                return {
                    title: v.title || "Untitled Video",
                    author: channelName,
                    timestamp: v.timestamp || "0:00",
                    thumbnail: thumbnailSrc,
                    url: v.url || ""
                };
            });
        } catch (err) {
            console.error("❌ [NJOY Search Error] Gagal melakukan pencarian:", err.message);
            return [];
        }
    });

    // 2. Fungsi Download YT-DLP
    ipcMain.handle('download-yt', async (event, url) => {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`\n📥 [NJOY Download] Memulai download dari YouTube: ${url}`);
                
                const metadataCommand = `chcp 65001 > nul && yt-dlp --skip-download --no-warnings --print "%(title)s" --print "%(uploader)s" --print "%(id)s" "${url}"`;
                exec(metadataCommand, async (metaError, stdout, stderr) => {
                    if (metaError) {
                        console.error("Gagal mendapatkan metadata video:", metaError.message);
                        runStandardYtDlp(url, resolve);
                        return;
                    }

                    const lines = stdout.trim().split('\n');
                    const rawTitle = lines[0]?.trim();
                    const rawUploader = lines[1]?.trim();
                    const videoId = lines[2]?.trim();

                    if (!rawTitle || !videoId) {
                        runStandardYtDlp(url, resolve);
                        return;
                    }

                    const cleanTitle = cleanSearchTerm(rawTitle);
                    const cleanUploader = cleanSearchTerm(rawUploader);
                    
                    // Kirim pembaruan judul ke renderer secara real-time
                    if (rawTitle) {
                        const displayTitle = cleanUploader ? `${cleanUploader} - ${cleanTitle}` : cleanTitle;
                        event.sender.send('download-metadata', { url, title: displayTitle });
                    }
                    
                    let searchQuery = cleanTitle;
                    if (cleanUploader && !cleanTitle.toLowerCase().includes(cleanUploader.toLowerCase())) {
                        searchQuery = cleanUploader + ' ' + cleanTitle;
                    }
                    
                    let coverUrl = null;
                    console.log(`🔍 [NJOY Cover Search] Mencari cover HD untuk: "${searchQuery}"`);

                    try {
                        const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&limit=1`;
                        const searchResult = await fetchJson(searchUrl);
                        if (searchResult && searchResult.results && searchResult.results.length > 0) {
                            const track = searchResult.results[0];
                            if (track.artworkUrl100) {
                                coverUrl = track.artworkUrl100.replace('100x100bb.jpg', '1000x1000bb.jpg');
                                console.log(`✨ [NJOY Cover Found] iTunes HD Cover Art: ${coverUrl}`);
                            }
                        }
                    } catch (searchErr) {
                        console.warn("Pencarian iTunes Search API gagal:", searchErr.message);
                    }

                    if (!coverUrl) {
                        coverUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                        console.log(`⚠️ [NJOY Fallback] Cover di iTunes tidak ditemukan. Menggunakan YouTube Thumbnail: ${coverUrl}`);
                    }

                    const tempCoverPath = path.join(app.getPath('temp'), `cover-${videoId}.jpg`);
                    try {
                        await downloadFile(coverUrl, tempCoverPath);
                    } catch (dlCoverErr) {
                        console.warn("Gagal mengunduh cover HD, coba fallback ke hqdefault:", dlCoverErr.message);
                        try {
                            if (coverUrl.includes('maxresdefault.jpg')) {
                                coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                await downloadFile(coverUrl, tempCoverPath);
                            } else {
                                throw dlCoverErr;
                            }
                        } catch (e) {
                            console.error("Gagal mengunduh cover sama sekali, jalankan download standar.");
                            runStandardYtDlp(url, resolve);
                            return;
                        }
                    }

                    const outputTemplate = path.join(__dirname, '../../songs', '%(uploader)s - %(title)s.mp3');
                    const getFilenameCommand = `chcp 65001 > nul && yt-dlp --get-filename -o "${outputTemplate}" "${url}"`;

                    exec(getFilenameCommand, (fnError, finalPathStdout) => {
                        if (fnError) {
                            console.error("Gagal mendapatkan nama file final:", fnError.message);
                            fs.unlink(tempCoverPath, () => {});
                            runStandardYtDlp(url, resolve);
                            return;
                        }

                        const finalPath = finalPathStdout.trim();
                        const tempAudioPath = finalPath.replace(/\.mp3$/, '_temp.mp3');

                        const downloadCommand = `chcp 65001 > nul && yt-dlp --no-cache-dir -x --audio-format mp3 --embed-metadata -o "${tempAudioPath}" "${url}"`;
                        console.log(`🚀 [NJOY Download] Menjalankan yt-dlp...`);

                        exec(downloadCommand, (dlError) => {
                            if (dlError) {
                                console.error("Gagal mendownload audio:", dlError.message);
                                fs.unlink(tempCoverPath, () => {});
                                fs.unlink(tempAudioPath, () => {});
                                resolve({ success: false, error: dlError.message });
                                return;
                            }

                            console.log(`🎵 [NJOY Metadata] Menyematkan Cover Art HD via FFmpeg...`);
                            const ffmpegCommand = `chcp 65001 > nul && ffmpeg -y -i "${tempAudioPath}" -i "${tempCoverPath}" -map 0:a -map 1:0 -c copy -id3v2_version 3 -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)" "${finalPath}"`;

                            exec(ffmpegCommand, (ffError) => {
                                fs.unlink(tempAudioPath, () => {});
                                fs.unlink(tempCoverPath, () => {});

                                if (ffError) {
                                    console.error("FFmpeg gagal menyematkan cover art:", ffError.message);
                                    fs.rename(tempAudioPath, finalPath, () => {});
                                    resolve({ success: true, warning: "Lagu terunduh tapi cover gagal dipasang" });
                                    return;
                                }

                                console.log(`✅ [NJOY Success] Lagu & Cover HD berhasil disimpan: ${finalPath}`);
                                resolve({ success: true });
                            });
                        });
                    });
                });
            } catch (e) {
                console.error("Kesalahan umum di download-yt handler:", e.message);
                resolve({ success: false, error: e.message });
            }
        });
    });

    // 3. Fungsi Download Spotify
    ipcMain.handle('download-spotify', async (event, url) => {
        return new Promise((resolve, reject) => {
            const outputTemplate = path.join(__dirname, '../../songs', '{artist} - {title}.{ext}');
            const command = `python -m spotdl download "${url}" --format mp3 --output "${outputTemplate}"`;

            exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Gagal spotdl: ${error.message}`);
                    resolve({ success: false, error: error.message });
                    return;
                }
                resolve({ success: true });
            });
        });
    });
}

function runStandardYtDlp(url, resolve) {
    console.log("Menjalankan unduhan standar dengan yt-dlp...");
    const outputTemplate = path.join(__dirname, '../../songs', '%(uploader)s - %(title)s.mp3');
    const command = `chcp 65001 > nul && yt-dlp --no-cache-dir -x --audio-format mp3 --embed-metadata --embed-thumbnail -o "${outputTemplate}" "${url}"`;
    exec(command, (error) => {
        if (error) {
            resolve({ success: false, error: error.message });
        } else {
            resolve({ success: true });
        }
    });
}

module.exports = {
    registerDownloaderHandlers
};

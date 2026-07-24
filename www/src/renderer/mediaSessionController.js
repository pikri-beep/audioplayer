// Controller untuk Integrasi Android MediaSession API & Lockscreen Notifications

function setupMediaSession() {
    if ('mediaSession' in navigator) {
        console.log("📱 [Android MediaSession] Initializing Lockscreen & Notification Controls...");
        
        const safeSetAction = (action, handler) => {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (e) {
                console.warn(`[MediaSession] Action ${action} not supported:`, e.message);
            }
        };

        safeSetAction('play', () => {
            if (window.player && window.player.audio && window.player.audio.togglePlay) {
                window.player.audio.togglePlay();
            }
        });

        safeSetAction('pause', () => {
            if (window.player && window.player.audio && window.player.audio.togglePlay) {
                window.player.audio.togglePlay();
            }
        });

        safeSetAction('previoustrack', () => {
            if (window.player.audio && window.player.audio.prevSong) {
                window.player.audio.prevSong(false);
            }
        });

        safeSetAction('nexttrack', () => {
            if (window.player.audio && window.player.audio.nextSong) {
                window.player.audio.nextSong(false);
            }
        });
    }
}

function updateMediaSessionMetadata(title, artist, artworkUrl) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title || 'Judul Lagu',
            artist: artist || 'Nama Artis',
            album: 'Audio Player',
            artwork: [
                { src: artworkUrl || 'assets/logo.png', sizes: '512x512', type: 'image/png' }
            ]
        });
    }
}

window.player = window.player || {};
window.player.mediaSession = {
    setupMediaSession,
    updateMediaSessionMetadata
};

setupMediaSession();

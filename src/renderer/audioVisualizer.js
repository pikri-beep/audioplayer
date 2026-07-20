let audioCtx = null;
let analyser = null;
let sourceNode = null;
let isInitialized = false;
let animationFrameId = null;

function initAudioVisualizer() {
    const canvas = document.getElementById('audio-wave-canvas');
    const audio = (window.player && window.player.dom) ? window.player.dom.audio : document.getElementById('audio-element');
    if (!canvas || !audio) return;

    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function setupWebAudio() {
        if (isInitialized) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.90; // Super smooth & fluid

            sourceNode = audioCtx.createMediaElementSource(audio);
            sourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);
            isInitialized = true;
        } catch (err) {
            console.warn('[AudioVisualizer] AudioContext init note:', err.message);
        }
    }

    // Connect Web Audio API on first play interaction
    audio.addEventListener('play', () => {
        if (!isInitialized) {
            setupWebAudio();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    });

    function draw() {
        animationFrameId = requestAnimationFrame(draw);

        // Don't calculate or render if canvas is hidden by user setting
        if (canvas.style.display === 'none') return;

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        // Get computed theme glow color
        const themeGlow = getComputedStyle(document.documentElement).getPropertyValue('--theme-glow').trim() || '#00f3ff';

        if (!analyser || (audio && audio.paused)) {
            // Draw calm breathing idle wave
            drawIdleWave(ctx, width, height, themeGlow);
            return;
        }

        const bufferLength = analyser.frequencyBinCount;
        const timeData = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(timeData);

        // Draw Clean & Smooth Audio Wave Line (Bottom Area)
        ctx.beginPath();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = themeGlow;
        ctx.shadowColor = themeGlow;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.65;

        const sliceWidth = width / bufferLength;
        let waveX = 0;
        const centerY = height * 0.82;

        for (let i = 0; i < bufferLength; i++) {
            const v = (timeData[i] - 128) / 128.0; // -1.0 to +1.0
            const y = centerY + (v * (height * 0.08)); // Max 8% height deviation

            if (i === 0) {
                ctx.moveTo(waveX, y);
            } else {
                ctx.lineTo(waveX, y);
            }

            waveX += sliceWidth;
        }

        ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }

    let idleTime = 0;
    function drawIdleWave(ctx, width, height, themeGlow) {
        idleTime += 0.015; // Slow, serene breathing wave speed
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = themeGlow;
        ctx.shadowColor = themeGlow;
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 0.3;

        const centerY = height * 0.82;
        for (let x = 0; x < width; x += 10) {
            const y = centerY + Math.sin(x * 0.008 + idleTime) * 5;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }

    draw();
}

if (!window.player) window.player = {};
window.player.visualizer = {
    initAudioVisualizer
};

document.addEventListener('DOMContentLoaded', () => {
    initAudioVisualizer();
});

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
            analyser.smoothingTimeConstant = 0.8;

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

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        // Get computed theme glow color
        const themeGlow = getComputedStyle(document.documentElement).getPropertyValue('--theme-glow').trim() || '#00f3ff';
        const themeBorder = getComputedStyle(document.documentElement).getPropertyValue('--theme-border').trim() || 'rgba(0, 243, 255, 0.4)';

        if (!analyser || (audio && audio.paused)) {
            // Draw idle gentle breathing wave
            drawIdleWave(ctx, width, height, themeGlow);
            return;
        }

        const bufferLength = analyser.frequencyBinCount;
        const freqData = new Uint8Array(bufferLength);
        const timeData = new Uint8Array(bufferLength);

        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        // 1. Draw Spectrum Bar Wave (Bottom)
        const barWidth = (width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (freqData[i] / 255) * (height * 0.35);

            const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(0.5, themeBorder);
            gradient.addColorStop(1, themeGlow);

            ctx.fillStyle = gradient;
            ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

            x += barWidth;
        }

        // 2. Draw Smooth Neon Oscilloscope Wave Line (Center-Bottom)
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = themeGlow;
        ctx.shadowColor = themeGlow;
        ctx.shadowBlur = 15;

        const sliceWidth = width / bufferLength;
        let waveX = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = timeData[i] / 128.0; // 0.0 to 2.0
            const y = (v * (height * 0.22)) + (height * 0.65);

            if (i === 0) {
                ctx.moveTo(waveX, y);
            } else {
                ctx.lineTo(waveX, y);
            }

            waveX += sliceWidth;
        }

        ctx.lineTo(width, height * 0.75);
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow for performance
    }

    let idleTime = 0;
    function drawIdleWave(ctx, width, height, themeGlow) {
        idleTime += 0.03;
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = themeGlow;
        ctx.shadowColor = themeGlow;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.35;

        const centerY = height * 0.75;
        for (let x = 0; x < width; x += 10) {
            const y = centerY + Math.sin(x * 0.01 + idleTime) * 8;
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

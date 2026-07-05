const { ipcRenderer } = require("electron");
const card = document.querySelector(".card");
const cover = document.getElementById("cover");
const title = document.getElementById("title");
const artist = document.getElementById("artist");

ipcRenderer.on("song-data", (_, song) => {
    title.textContent = song.title;
    artist.textContent = song.artist;
    
    if (song.cover) {
        // Cek apakah ini gambar default atau gambar dari file mp3
        if (song.cover === "covers/default.png") {
            // Mundur satu direktori karena file ini ada di dalam folder 'notification'
            cover.src = "../covers/default.png";
        } else {
            // Kalau gambar asli dari metadata temp/custom, baru pakai file://
            cover.src = "file://" + song.cover + "?t=" + Date.now();
        }
    }
    playAnimation();
});

function playAnimation(){
    card.style.transform="translateX(120%)";
    card.style.opacity="0";

    requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
            card.style.transform="translateX(0)";
            card.style.opacity="1";
        });
    });

    clearTimeout(window.hideTimer);

    window.hideTimer=setTimeout(()=>{
        card.style.transform="translateX(120%)";
        card.style.opacity="0";
    },3600);
}


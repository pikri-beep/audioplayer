# 🎵 NJOY Music Player

NJOY Music Player adalah aplikasi pemutar musik desktop modern yang dibangun menggunakan **Electron.js**, HTML, CSS, dan JavaScript. Aplikasi ini dirancang dengan antarmuka yang sangat *customizable*, ringan, dan dilengkapi dengan berbagai tema visual dinamis yang mengubah seluruh tampilan UI (termasuk *progress bar*, *scrollbar*, dan pop-up).

## ⚠️ SYARAT WAJIB SEBELUM INSTALL!
Karena aplikasi ini menggunakan mesin downloader kelas berat, komputer kamu **WAJIB** terinstall:
1. **Python** (Pastikan 'Add to PATH' dicentang saat install)
2. **FFmpeg**
3. Buka CMD/Terminal lalu ketik perintah ini untuk menginstall mesinnya:
   `pip install spotdl`
   `spotdl --download-ffmpeg`
   `pip install yt-dlp`

## ✨ Fitur Utama

- **Custom Themes Engine:** Ubah tampilan aplikasi secara *real-time* tanpa *restart*. Tema yang tersedia:
  - 🟩 **Minecraft (Blocky):** UI kotak 8-bit dengan warna tanah dan rumput.
  - 🕸️ **Spider-Man:** Nuansa merah-biru jaring laba-laba dengan *font* komik.
  - 🤠 **Toy Story:** Warna cerah ala mainan (kuning, merah, biru).
  - 💻 **Terminal Hacker:** Hijau neon dengan gaya *command prompt* dan kursor berkedip.
  - 🛡️ **Marvel (MCU):** Tema merah gelap dengan aksen emas Iron Man.
  - 👾 **Pixel Art Retro:** Gaya antarmuka konsol *game* lawas (NES/Gameboy).
- **Smart Playlist Search:** Filter dan cari lagu secara instan (*real-time*).
- **Global Shortcuts:** Kontrol musik dari mana saja, bahkan saat bermain *game*:
  - `Ctrl + Space` : Play / Pause
  - `Ctrl + Right` : Next Track
  - `Ctrl + Left` : Previous Track
  - `Ctrl + Up/Down`: Volume Up / Down
  - `Ctrl + M` : Mute / Unmute
- **Mode Fleksibel:** Mendukung mode *Always on Top* dan berjalan di latar belakang (System Tray).
- **Mini Player** 
- **Search Lagu & Download via yt-dlp**

---

## 📥 Sumber Lagu (.mp3)
Aplikasi ini memutar file musik berformat `.mp3` secara lokal. 
Jika kamu ingin mencari dan mendownload lagu-lagu favoritmu (misalnya dari Spotify) untuk diputar di aplikasi ini, kamu bisa menggunakan layanan gratis berikut:

👉 **[Download MP3 via Spotidown](https://spotidown.co/en6)**

  **BARU DAPAT DOWNLOAD LAGU DARI APLIKASI MENGGUNAAN YTDLP & SPOTDLP**

*(Catatan: Pastikan file lagu berformat `.mp3` dan letakkan di dalam folder `songs` atau buka secara manual dari dalam aplikasi).*

---

## 🚀 Instalasi & Penggunaan

Pastikan kamu sudah menginstal **[Node.js](https://nodejs.org/)** dan **Git** di komputermu.

**1. Clone Repository**
Buka terminal/CMD, lalu jalankan perintah ini untuk mengunduh kode sumber:
```bash
git clone https://github.com/pikri-beep/audioplayer.git
```

**2. Masuk ke Folder Proyek**
```bash
cd [NAMA-REPO-KAMU]
```

**3. Install Dependencies**
Unduh semua modul yang dibutuhkan oleh Electron:

```bash
npm install
```
**4. Jalankan Aplikasi**
Mulai aplikasi NJOY Music Player:

```bash
npm start
```

# ⚙️ Cara Menggunakan Aplikasi
1. Memasukkan Lagu: Aplikasi akan otomatis membaca lagu-lagu .mp3 yang ada di dalam folder songs (jika folder belum ada, aplikasi akan membuatnya otomatis saat pertama kali dijalankan). Kamu juga bisa menggunakan tombol Open File di aplikasi untuk memilih lagu dari folder lain.

2. Mengganti Tema: Klik ikon Gear (Settings) di pojok kanan atas, lalu pilih tema dari menu dropdown. Seluruh UI (termasuk modal pop-up dan scrollbar) akan langsung beradaptasi dengan tema yang dipilih!

3. Mute Cepat: Klik langsung pada ikon speaker di sebelah slider volume untuk mematikan/menyalakan suara seketika.

# 🛠️ Teknologi yang Digunakan
1. Electron.js - Desktop App Framework
2. Vanilla JS (ES6) - Logika & IPC Communication
3. CSS3 - Custom Theming & Animations
4. HTML5 - Audio API & Struktur UI
5. Font Awesome - Ikon Vektor
6. Google Fonts - Custom Fonts (Press Start 2P, Bangers, Chewy)


***
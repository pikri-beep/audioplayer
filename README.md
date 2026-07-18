# 🎵 NJOY Music Player

NJOY Music Player adalah aplikasi pemutar musik desktop modern dan interaktif yang dibangun di atas **Electron.js**, HTML, CSS, dan JavaScript. Aplikasi ini dirancang dengan antarmuka yang sangat *customizable*, ringan, dan dilengkapi dengan tema visual dinamis yang dapat mengubah seluruh komponen UI secara real-time.

---

## 🛠️ Persyaratan Sistem (Wajib)
Aplikasi ini dilengkapi dengan fitur pencarian dan pengunduhan musik terintegrasi. Agar fitur tersebut berfungsi dengan baik, pastikan komputer Anda telah terinstal:

1. **Node.js** (versi LTS direkomendasikan)
2. **Python** (Pastikan opsi *'Add to PATH'* dicentang saat instalasi)
3. **FFmpeg** (Pastikan terdaftar di PATH sistem Anda)

### Instalasi Dependensi Pengunduh
Jalankan perintah berikut di Terminal / Command Prompt untuk menginstal pustaka pengunduh:
```bash
pip install spotdl yt-dlp
```

---

## ✨ Fitur Utama

### 🎨 Sistem Tema Real-Time (Custom Themes Engine)
Ubah nuansa visual pemutar musik Anda secara instan tanpa perlu memuat ulang (*restart*) aplikasi:
* 👾 **Pixel Art Retro:** Estetika konsol game lawas (8-bit) dengan warna dan font *pixelated*.
* 💻 **Terminal Hacker:** Tema gelap dengan teks hijau neon ala command prompt dan kursor berkedip.
* 🟩 **Minecraft (Blocky):** UI bertekstur kaku 8-bit khas elemen tanah dan rumput.
* 🕸️ **Spider-Man:** Nuansa merah-biru jaring laba-laba yang ikonik dengan font bergaya komik.
* 🛡️ **Marvel (MCU):** Kombinasi warna merah gelap dengan aksen emas Iron Man yang premium.
* 🤠 **Toy Story:** Warna-warni ceria yang menyenangkan khas dunia mainan Woody & Buzz.

### 📥 Pengunduh Musik Cerdas (YouTube & Spotify)
* **Spotify Downloader (SpotDL):** Unduh lagu secara otomatis dengan memasukkan tautan lagu Spotify.
* **YouTube HD Downloader:** Mencari lagu langsung dari aplikasi atau memasukkan tautan YouTube. Aplikasi akan mencari cover album resmi beresolusi tinggi (HD 1000x1000) melalui iTunes API secara otomatis dan menyematkannya ke dalam file MP3 menggunakan FFmpeg (dengan fallback otomatis ke thumbnail HD YouTube).

### 🗑️ Manajemen Playlist yang Mudah
* **Tombol Hapus (Delete) Langsung:** Hapus lagu dari dalam aplikasi tanpa perlu membuka folder secara manual di File Explorer. Dilengkapi dengan **modal konfirmasi kustom** yang otomatis menyesuaikan dengan tema aktif Anda.
* **Smart Search:** Cari lagu di playlist Anda secara instan (*real-time filtering*).
* **Mode Favorit (NJOY Mode):** Tandai lagu favorit dengan tombol hati untuk membuat daftar putar eksklusif.

### 🎤 Lirik Karaoke Berjalan
* Sinkronisasi otomatis lirik berjalan (*synced lyrics* / LRC format) menggunakan LRCLIB API.

---

## ⌨️ Pintasan Keyboard (Shortcuts)

### 📌 Global Shortcuts (Dapat digunakan meski aplikasi di-minimize/background)
| Pintasan | Fungsi |
| :--- | :--- |
| `Ctrl + Shift + Space` | Putar / Jeda (Play / Pause) |
| `Ctrl + Right` | Lagu Berikutnya (Next Track) |
| `Ctrl + Left` | Lagu Sebelumnya (Previous Track) |
| `Ctrl + M` | Bisukan Suara (Mute / Unmute) |

### 💻 Local Shortcuts (Aktif saat jendela aplikasi difokuskan)
| Tombol | Fungsi |
| :--- | :--- |
| `Space` | Putar / Jeda (Play / Pause) |
| `Arrow Right` | Lagu Berikutnya (Next Track) |
| `Arrow Left` | Lagu Sebelumnya (Previous Track) |
| `Arrow Up` | Naikkan Volume (+5%) |
| `Arrow Down` | Turunkan Volume (-5%) |
| `Escape` | Melepas fokus kolom pencarian |

---

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

1. **Clone Repository**
   ```bash
   git clone https://github.com/pikri-beep/audioplayer.git
   cd audioplayer
   ```

2. **Install Dependensi Node.js**
   ```bash
   npm install
   ```

3. **Jalankan Aplikasi**
   ```bash
   npm start
   ```

---

## 📂 Struktur Modul Kode Terkini
Kode aplikasi telah dimodularisasi agar lebih profesional dan mudah dikembangkan:
* `main.js` & `renderer.js`: Berperan sebagai loader & bootstrapper utama (ringkas, <100 baris).
* `src/main/`: Menangani manajemen jendela (BrowserWindow), global shortcuts, event IPC, dan proses download (yt-dlp/ffmpeg).
* `src/renderer/`: Mengatur audio playback, rendering playlist, parser lirik, dan seluruh interaksi UI.

---

## 🛠️ Teknologi yang Digunakan
* **Electron.js** - Framework Aplikasi Desktop
* **Vanilla JS (ES6)** - Logika Aplikasi & Komunikasi IPC
* **CSS3** - Custom Theming, Layout Flexbox, & Animasi
* **HTML5** - Struktur UI & Audio API
* **Vibrant.js** - Ekstraksi warna cover album dinamis untuk warna aksen UI
* **Font Awesome** - Ikonografi UI
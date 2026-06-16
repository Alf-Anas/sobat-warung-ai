# 🏪 SobatWarung AI

> **"Solusi Pintar Keuangan dan Pemasaran UMKM dalam Satu Genggaman"**

SobatWarung AI adalah platform pembukuan digital dan asisten pemasaran pintar yang dirancang khusus untuk pelaku UMKM (Usaha Mikro, Kecil, dan Menengah) di Indonesia. Dengan memanfaatkan teknologi kecerdasan buatan (**Gemini AI**), SobatWarung mempermudah pemilik warung untuk mencatat keuangan melalui ucapan suara sehari-hari, melacak stok gudang, mencetak struk belanja/invoice pelanggan, serta membuat konten promosi media sosial secara otomatis.

📱 **Coba Versi Live Sekarang:** [https://sobat-warung.geoit.dev/](https://sobat-warung.geoit.dev/)

---

## ✨ Fitur Unggulan (Core Features)

### 1. 🎙️ Asisten Suara AI (Voice-to-Text Ledger)
Pemilik warung tidak perlu repot mengetik secara manual satu per satu. Cukup tekan tombol mikrofon dan bicaralah menggunakan bahasa sehari-hari.
* **Contoh Ucapan:** *"Barusan laku sembako 3 pak total 45 ribu, modalnya 35 ribu."*
* **Bagaimana AI Bekerja:** Sistem memanfaatkan mikrofon perangkat melalui Web Speech API untuk melakukan transkripsi suara Bahasa Indonesia, lalu menggunakan integrasi model **Gemini API** di sisi *server-side* untuk menafsirkan ucapan tersebut ke dalam data terstruktur (Nama unit produk, kategori, jumlah, total harga, perkiraan modal harian, serta catatan transaksi lainnya).

### 2. 🛒 Formulir Manual & Pembuat Invoice (Invoice Generator)
Jika ingin menyusun beberapa item belanjaan sekaligus untuk satu pelanggan:
* Dilengkapi dengan fitur **Keranjang Belanja (Grup Transaksi)**.
* Pencarian cepat produk langsung dari **gudang stok**.
* Kalkulasi otomatis total tagihan belanjaan dan proyeksi keuntungan bersih (laba bersih).
* **Cetak Nota & Simpan PDF:** Klik tombol cetak untuk langsung menghasilkan nota struk/invoice fisik atau menyimpan ke format PDF siap kirim ke WhatsApp pelanggan.

### 3. 📦 Manajemen Inventaris & Gudang Stok (Smart Inventory)
Mencegah kehabisan stok barang di warung:
* Pantau status persediaan stok barang secara langsung (*real-time*).
* Dilengkapi dengan deteksi stok kritis (indikasi barang akan habis).
* Rekomendasi penetapan harga jual dari modal rata-rata kulakan (*Cost of Goods Sold/COGS*) untuk memastikan warung Anda selalu meraup margin profit yang sehat.

### 4. 📈 Laporan & Catatan Keuangan (Financial Dashboard)
Visualisasikan kinerja bisnis dengan indikator finansial yang bersih:
* **Analisis Finansial Utama:** Total Omset Penjualan, Laba Bersih yang didapat, Pengeluaran Kulakan harian, serta Rata-rata margin profit warung.
* **Saringan Transaksi (Filters):** Cari data dengan mudah berdasarkan jenis transaksi, nama barang, kode nota, catatan, atau kategori produk (Sembako, Minyak, Beras, Minuman, Camilan, Bumbu, dll).

### 5. 📣 Pembuat Konten Pemasaran Medsos (AI Social Media Promo Generator)
Buat konten promosi berkualitas untuk WhatsApp Story, Facebook, atau Instagram Anda tanpa mempekerjakan desainer:
* Pilih produk dari gudang stok terbaik Anda.
* Gemini AI akan menghasilkan materi promosi kreatif, lengkap dengan *caption* memikat, daftar harga, promo diskon, serta tagar media sosial yang relevan.
* Pratinjau poster instan yang siap disalin untuk disebarkan ke calon pelanggan.

---

## 🛠️ Teknologi & Arsitektur (Tech Stack)

SobatWarung AI dirancang dengan fondasi teknologi modern, cepat, dan handal:

* **Sisi Klien (Frontend):**
  * **React 19** & **TypeScript** untuk performa aplikasi yang stabil dan bebas bug tipe data.
  * **Tailwind CSS** untuk antarmuka yang sangat responsif, tajam, dan nyaman di mata (Mobile-first, desktop-friendly).
  * **Motion (by React)** untuk visual transisi animasi navigasi yang halus.
  * **IndexedDB (`sobat_warung_db`)** untuk penyimpanan lokal berkapasitas besar secara *offline-first*. Data Anda tidak akan hilang meskipun browser dimuat ulang.

* **Sisi Server (Backend):**
  * **Node.js + Express** sebagai jalur API server pintasan yang aman (*reverse-proxied*).
  * **@google/genai (TypeScript SDK)**: Terhubung ke model **Gemini-2.0 / Gemini-1.5** di server-side untuk memastikan kunci rahasia API (*API Key Security*) tetap aman tersembunyi dari peretas browser.

---

## 🚀 Jalankan Secara Lokal (Local Development)

Untuk memulai pengembangan atau menjalankan aplikasi ini di komputer Anda sendiri, ikuti langkah-langkah berikut:

### Prasyarat
* Node.js (v18 ke atas) & npm

### Langkah Instalasi

1. **Unduh repositori & instalasi dependensi:**
   ```bash
   npm install
   ```

2. **Pengaturan Kunci API (Environment Variables):**
   Buat file `.env` di direktori utama proyek Anda dan isi kunci API Gemini dari Google AI Studio:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Jalankan dalam mode Pengembangan (Development):**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan secara otomatis di portal lokal.

4. **Kompilasi Produksi (Production Build):**
   ```bash
   npm run build
   ```
   Perintah di atas akan mengompilasi seluruh elemen klien ke direktori `dist/` dan membundel skrip server menggunakan `esbuild` menjadi format mandiri CommonJS di `dist/server.cjs` untuk performa server instan yang optimal.

5. **Jalankan Server Produksi:**
   ```bash
   npm start
   ```

---

## 🔒 Privasi & Keamanan Data
Data keuangan, riwayat transaksi, profil pemilik warung, dan jumlah stok barang dienkripsi dan disimpan langsung di perangkat Anda menggunakan teknologi **IndexedDB lokal**. SobatWarung AI tidak mengunggah data pembukuan internal Anda ke awan cloud pihak ketiga kecuali permintaan interaksi pengenalan suara dan pembuatan promosi yang dilimpahkan ke modul enkripsi Gemini AI.

---

## 🔗 Tautan Terkait
* **Demo Aplikasi Live:** [https://sobat-warung.geoit.dev/](https://sobat-warung.geoit.dev/)
* **Platform Utama:** Google AI Studio Build

*SobatWarung AI - Makin Praktis Nyatetnya, Makin Laris Jualannya!* 🏪🚀

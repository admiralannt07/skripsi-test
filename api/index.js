/**
 * ============================================================
 * PENJELASAN FUNGSI PADA index.js
 * ============================================================
 *
 * File index.js berperan sebagai BACKEND (server API) yang dibangun dengan
 * Express.js. Fungsi utamanya adalah:
 *
 * 1. Menyediakan endpoint HTTP POST /api/generate
 * 2. Menerima permintaan dari frontend (script.js) berupa teks prompt
 * 3. Meneruskan prompt tersebut ke Google Gemini API
 * 4. Mengembalikan hasil teks yang dihasilkan AI ke frontend
 *
 * Alur logika rinci:
 *
 * a. Middleware
 *    - cors() : mengizinkan permintaan lintas-asal (CORS) agar frontend
 *      yang berjalan di domain/port berbeda dapat memanggil API ini.
 *    - express.json() : mem-parse body JSON yang dikirim oleh frontend,
 *      sehingga kita bisa membaca req.body.prompt.
 *
 * b. Handler /api/generate
 *    - Validasi API key: memastikan GEMINI_API_KEY ada di environment.
 *    - Membentuk URL endpoint Gemini (model gemini-2.5-flash-preview).
 *    - Membentuk payload sesuai format Gemini: { contents: [{ parts: [{ text: prompt }] }] }.
 *    - Mengirim permintaan POST ke Gemini menggunakan axios.
 *    - Ekstraksi hasil: mengambil teks dari path
 *      response.data.candidates[0].content.parts[0].text.
 *    - Jika berhasil, mengirim JSON { text: <hasil AI> } kembali ke frontend.
 *    - Jika terjadi kesalahan (network, validasi, atau respons kosong),
 *      mengirim status 500 dengan pesan error.
 *
 * Hubungan dengan script.js:
 * -----------------------------------------------------------
 * - script.js berjalan di browser (frontend) dan tidak bisa langsung
 *   memanggil Gemini API karena keterbatasan CORS & keamanan API key.
 * - script.js mengirim fetch() ke endpoint /api/generate milik index.js,
 *   dengan body JSON { prompt: <teks pertanyaan pengguna> }.
 * - index.js bertindak sebagai proxy: menerima permintaan, menambahkan
 *   API key rahasia di server, memanggil Gemini, lalu mengembalikan
 *   hasilnya ke script.js.
 * - Dengan pola ini, API key Gemini tidak ter-expose ke publik,
 *   dan CORS dikendalikan sepenuhnya oleh backend.
 *
 * ============================================================
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

// Konfigurasi dotenv untuk membaca .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// app.use(express.static('.'));

// Endpoint untuk generate konten
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('API key tidak ditemukan di .env, buat atau periksa file .env dan tambahkan GEMINI_API_KEY');
        }

        // Menggunakan model yang sama dengan frontend
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        // Membentuk objek payload sesuai format yang dipersyaratkan oleh Google Gemini API:
        // - contents: array yang berisi satu objek
        // - parts: array di dalam objek tersebut berisi satu objek
        // - text: nilai prompt pengguna diletakkan di sini
        const payload = { contents: [{ parts: [{ text: prompt }] }] };

        // Mengirim permintaan POST ke endpoint Gemini dengan payload di atas
        const response = await axios.post(apiUrl, payload);

        // Mengekstrak teks hasil dari respons API menggunakan optional chaining
        // untuk menghindari error jika struktur data tidak lengkap
        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('Respons dari AI tidak valid atau kosong');
        }

        res.json({ text });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ 
            error: 'Gagal menghubungi Gemini API',
            details: error.message 
        });
    }
});

// Jalankan server
// app.listen(port, () => {
//     console.log(`Server berjalan di http://localhost:${port}`);
// });

// Ekspor aplikasi untuk Vercel
module.exports = app;
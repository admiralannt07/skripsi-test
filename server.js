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
app.use(express.static('.'));

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
        const payload = { contents: [{ parts: [{ text: prompt }] }] };

        const response = await axios.post(apiUrl, payload);
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
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});


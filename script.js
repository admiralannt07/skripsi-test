// --- LOGIKA UNTUK PERPINDAHAN TAMPILAN ---
const landingPage = document.getElementById('landing-page');
const appWizard = document.getElementById('app-wizard');
const ctaButtons = [document.getElementById('cta-hero'), document.getElementById('cta-final')];
const backButton = document.getElementById('back-to-landing');

function showWizard() {
    landingPage.classList.add('hidden');
    appWizard.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function showLandingPage() {
    appWizard.classList.add('hidden');
    landingPage.classList.remove('hidden');
}

ctaButtons.forEach(button => button.addEventListener('click', showWizard));
backButton.addEventListener('click', showLandingPage);

// --- LOGIKA APLIKASI INTI & INTEGRASI GEMINI API ---

// Variabel untuk menyimpan state aplikasi
const appState = {
    selectedTitle: null,
    generatedRumusan: null,
    isGenerating: false,
};

// Kunci API (dibiarkan kosong, akan diisi oleh environment)
const apiKey = ""; 

// Elemen DOM untuk Wizard
const jurusanInput = document.getElementById('jurusan-input');
const minatInput = document.getElementById('minat-input');
const generateJudulBtn = document.getElementById('generate-judul-btn');
const judulOutputContainer = document.getElementById('judul-output-container');

const step2Section = document.getElementById('step-2');
const step2Indicator = document.getElementById('step-2-indicator');
const judulPilihanDisplay = document.getElementById('judul-pilihan-display');
const generateRumusanBtn = document.getElementById('generate-rumusan-btn');
const rumusanOutputContainer = document.getElementById('rumusan-output-container');

const step3Section = document.getElementById('step-3');
const step3Indicator = document.getElementById('step-3-indicator');
const generateKerangkaBtn = document.getElementById('generate-kerangka-btn');
const kerangkaOutputContainer = document.getElementById('kerangka-output-container');

// --- Fungsi Helper ---

// Menampilkan indikator loading
function showLoading(container, message) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
            <div class="spinner"></div>
            <p class="mt-4 text-gray-600 animate-pulse">${message}</p>
        </div>`;
}

// Menampilkan pesan error
function renderError(container, message) {
    container.innerHTML = `
        <div class="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg">
            <h3 class="font-bold">Oops! Terjadi Kesalahan</h3>
            <p>${message}</p>
        </div>`;
}

// Mengaktifkan langkah wizard berikutnya
function activateStep(stepElement, indicatorElement) {
        stepElement.classList.remove('step-disabled');
        indicatorElement.classList.remove('bg-gray-400');
        indicatorElement.classList.add('bg-[#673AB7]');
}

// Menangani status tombol saat proses generating
function setGenerating(status) {
    appState.isGenerating = status;
    generateJudulBtn.disabled = status;
    generateRumusanBtn.disabled = status || !appState.selectedTitle;
    generateKerangkaBtn.disabled = status || !appState.generatedRumusan;
}

 // --- Fungsi Inti Pemanggilan Gemini API ---
/**
 * Fungsi utama untuk berkomunikasi dengan backend Gemini API.
 * 
 * Logika ringkas:
 * 1. Menandakan aplikasi sedang "generating" (tombol-tombol disabled).
 * 2. Menyiapkan URL & payload untuk endpoint /api/generate (bukan ke Google langsung).
 * 3. Melakukan fetch maksimal `maxRetries` kali (default 3) dengan exponential backoff.
 * 4. Setiap percobaan:
 *    - Jika response.ok → validasi ada teks → return teks.
 *    - Jika gagal → tunggu 2^i detik sebelum coba lagi.
 * 5. Setelah percobaan terakhir masih gagal → lempar error & enable kembali tombol.
 * 
 * Perubahan dibanding versi sebelumnya:
 * - Sebelumnya: langsung fetch ke Google Gemini dengan header x-goog-api-key.
 * - Sekarang: fetch ke endpoint lokal `/api/generate` tanpa header kunci; kunci API
 *   dikelola sepenuhnya di server (environment variable), sehingga kunci tidak
 *   terpapar di klien & penanganan CORS/keamanan dikendalikan backend.
 * - Retry & error-handling tetap sama; hanya URL & header yang disederhanakan.
 */
async function panggilGemini(promptText, maxRetries = 3) {
    // Nonaktifkan tombol selama proses berlangsung
    setGenerating(true);

    // Endpoint lokal yang akan meneruskan permintaan ke Google
    // Menyiapkan URL endpoint lokal yang akan meneruskan permintaan ke backend
    const apiUrl = `api/generate`;
    // Membungkus teks prompt ke dalam objek agar bisa dikirim sebagai JSON
    const payload = { prompt: promptText };

    // Loop retry hingga maxRetries kali
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Kirim permintaan POST ke backend
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            // Jika response tidak ok, bangkitkan error dengan detail dari backend
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || errorData.details || `HTTP error! status: ${response.status}`
                );
            }

            // Ekstrak teks hasil dari AI
            const result = await response.json();
            const text = result.text;

            // Validasi teks tidak boleh kosong
            if (!text) {
                throw new Error('Respons dari AI tidak valid atau kosong.');
            }

            // Sukses: aktifkan kembali tombol & kembalikan teks
            setGenerating(false);
            return text;
        } catch (error) {
            // Log setiap kegagalan untuk debugging
            console.error(`Attempt ${i + 1} failed:`, error);

            // Jika sudah percobaan terakhir, lempar error & aktifkan tombol
            if (i === maxRetries - 1) {
                setGenerating(false);
                throw error;
            }

            // Exponential backoff: tunggu 2^i detik sebelum retry
            await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
        }
    }
}


// --- Logika untuk Langkah 1: Generate Judul ---
generateJudulBtn.addEventListener('click', async () => {
    const jurusan = jurusanInput.value.trim();
    const minat = minatInput.value.trim();

    if (!jurusan || !minat) {
        renderError(judulOutputContainer, "Harap isi Program Studi dan Topik Minat terlebih dahulu.");
        return;
    }
    
    showLoading(judulOutputContainer, "AI sedang meracik ide judul untuk Anda...");

    const prompt = `Buatkan 5-7 ide judul skripsi yang menarik dan relevan untuk mahasiswa jurusan "${jurusan}" dengan fokus pada topik "${minat}". Pastikan judul bersifat spesifik dan memiliki potensi riset yang baik. Sajikan hasilnya dalam format daftar bernomor (contoh: 1. Judul A).`;

    try {
        const hasil = await panggilGemini(prompt);
        const judulArray = hasil.split('\n').filter(line => line.match(/^\d+\.\s/)).map(line => line.replace(/^\d+\.\s/, '').trim());

        if (judulArray.length === 0) {
                renderError(judulOutputContainer, "AI tidak dapat menghasilkan judul dari input yang diberikan. Coba gunakan topik yang lebih spesifik.");
                return;
        }

        judulOutputContainer.innerHTML = `
            <h3 class="font-bold text-gray-800 mb-2">Pilih Salah Satu Ide Judul:</h3>
            <div class="space-y-2" id="title-options">
                ${judulArray.map((judul, index) => `
                    <label for="judul-${index}" class="block p-4 border rounded-lg hover:bg-purple-50 cursor-pointer transition-colors has-[:checked]:bg-purple-100 has-[:checked]:border-purple-400">
                        <input type="radio" name="selected-title" id="judul-${index}" value="${judul}" class="hidden">
                        <span class="text-gray-700">${judul}</span>
                    </label>
                `).join('')}
            </div>`;

        // Tambahkan event listener untuk pilihan judul
        document.getElementById('title-options').addEventListener('change', (e) => {
            if (e.target.name === 'selected-title') {
                appState.selectedTitle = e.target.value;
                judulPilihanDisplay.textContent = appState.selectedTitle;
                judulPilihanDisplay.classList.remove('text-gray-500');
                activateStep(step2Section, step2Indicator);
                generateRumusanBtn.disabled = appState.isGenerating;
            }
        });

    } catch (error) {
        renderError(judulOutputContainer, `Gagal menghubungi AI: ${error.message}. Silakan coba lagi nanti.`);
    }
});

// --- Logika untuk Langkah 2: Generate Rumusan Masalah ---
generateRumusanBtn.addEventListener('click', async () => {
    if (!appState.selectedTitle) return;

    showLoading(rumusanOutputContainer, "AI sedang merumuskan masalah dari judul pilihan Anda...");

    const prompt = `Berdasarkan judul skripsi: "${appState.selectedTitle}", buatkan 3-5 poin rumusan masalah yang tajam, spesifik, dan dapat diuji. Sajikan hasilnya dalam format daftar bernomor.`;

    try {
        const hasil = await panggilGemini(prompt);
        appState.generatedRumusan = hasil;
        rumusanOutputContainer.innerHTML = `
            <div class="p-4 bg-gray-50 rounded-lg border">
                <h4 class="font-bold mb-2">Hasil Rumusan Masalah:</h4>
                <div class="prose prose-sm max-w-none text-gray-800">${hasil.replace(/\n/g, '<br>')}</div>
            </div>`;
        
        activateStep(step3Section, step3Indicator);
        generateKerangkaBtn.disabled = appState.isGenerating;

    } catch(error) {
        renderError(rumusanOutputContainer, `Gagal menghubungi AI: ${error.message}.`);
    }
});

// --- Logika untuk Langkah 3: Generate Kerangka Bab 1 ---
generateKerangkaBtn.addEventListener('click', async () => {
        if (!appState.selectedTitle || !appState.generatedRumusan) return;

        showLoading(kerangkaOutputContainer, "Finalisasi! AI sedang menyusun draf kerangka Bab 1...");
        
        const prompt = `Anda adalah asisten akademik. Buatkan draf kerangka proposal Bab 1 yang komprehensif untuk skripsi dengan detail berikut:
        - Judul: "${appState.selectedTitle}"
        - Rumusan Masalah yang harus dijawab:
        ${appState.generatedRumusan}

        Struktur output harus mencakup poin-poin berikut dengan penjelasan singkat di setiap poinnya:
        A. Latar Belakang Masalah (jelaskan konteks, fenomena, data pendukung jika ada, dan urgensi masalah yang mengarah ke judul)
        B. Rumusan Masalah (sajikan kembali poin rumusan masalah yang diberikan)
        C. Tujuan Penelitian (sesuai dengan rumusan masalah)
        D. Manfaat Penelitian (jelaskan manfaat teoritis dan praktis)
        
        Gunakan bahasa yang formal dan akademis.`;

    try {
        const hasil = await panggilGemini(prompt);
        kerangkaOutputContainer.innerHTML = `
            <div class="relative">
                    <h4 class="font-bold mb-2">Draf Kerangka Proposal (Bab 1):</h4>
                    <button id="copy-btn" class="absolute top-0 right-0 bg-gray-200 text-gray-700 text-xs font-bold py-1 px-2 rounded hover:bg-gray-300">Salin Teks</button>
                    <textarea id="kerangka-textarea" readonly class="w-full h-96 p-4 bg-gray-50 border rounded-lg mt-2 resize-none">${hasil}</textarea>
            </div>`;

        // Tambahkan event listener untuk tombol salin
        document.getElementById('copy-btn').addEventListener('click', () => {
            const textArea = document.getElementById('kerangka-textarea');
            textArea.select();
            document.execCommand('copy');
            const copyBtn = document.getElementById('copy-btn');
            copyBtn.textContent = 'Tersalin!';
            setTimeout(() => { copyBtn.textContent = 'Salin Teks'; }, 2000);
        });

    } catch(error) {
            renderError(kerangkaOutputContainer, `Gagal menghubungi AI: ${error.message}.`);
    }
});
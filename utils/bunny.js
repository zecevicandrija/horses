// backend/utils/bunny.js
const axios = require('axios');
const crypto = require('crypto'); // NOVO: Uvozimo 'crypto' modul

const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
const apiKey = process.env.BUNNY_STREAM_API_KEY;
// NOVO: Učitavamo i ključ za autorizaciju tokena
const tokenAuthKey = process.env.BUNNY_STREAM_TOKEN_KEY;

const bunnyAPI = axios.create({
    baseURL: 'https://video.bunnycdn.com',
    headers: { 'AccessKey': apiKey }
});

// Funkcije createVideo i uploadVideo ostaju potpuno ISTE
const createVideo = async (title) => {
    try {
        const { data } = await bunnyAPI.post(`/library/${libraryId}/videos`, { title });
        return data;
    } catch (error) {
        console.error("Bunny API greška (createVideo):", error.response?.data);
        throw error;
    }
};

const uploadVideo = async (videoGuid, fileStream) => {
    try {
        // IZMENA: Podrška za stream i unlimited body length
        await axios.put(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`, fileStream, {
            headers: {
                'AccessKey': apiKey,
                'Content-Type': 'application/octet-stream'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        console.log(`Video sa GUID ${videoGuid} je uspešno uploadovan.`);
    } catch (error) {
        console.error("Bunny API greška (uploadVideo):", error.response?.data);
        throw error;
    }
};

// --- OVO JE KLJUČNA PROMENA ---
// Stara, nebezbedna funkcija getPlayerUrl se briše.
// Umesto nje, dodajemo novu, sigurnu funkciju.

const getSecurePlayerUrl = (videoId) => {
    if (!tokenAuthKey) {
        console.error("BUNNY_TOKEN_AUTH_KEY nije postavljen u .env fajlu!");
        throw new Error('Token ključ za autorizaciju nije konfigurisan.');
    }

    // Token će važiti 3 sata. Možete promeniti po potrebi.
    const expires = Math.floor(Date.now() / 1000) + 3 * 60 * 60;

    const path = `/embed/${libraryId}/${videoId}`;
    const message = videoId + expires;
    const token = crypto
        .createHash('sha256')
        .update(tokenAuthKey + videoId + expires)
        .digest('hex');

    // Sastavljanje sigurnog URL-a
    const secureUrl = `https://iframe.mediadelivery.net${path}?token=${token}&expires=${expires}`;

    return secureUrl;
};

// Ažuriramo šta izvozimo iz fajla
module.exports = { createVideo, uploadVideo, getSecurePlayerUrl };
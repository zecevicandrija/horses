require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

// Uvoz svih vaših ruta
const authRouter = require('./routes/auth');
const korisniciRouter = require('./routes/korisnici'); 
const kurseviRouter = require('./routes/kursevi');
const lekcijeRouter = require('./routes/lekcije');
const wishlistRouter = require('./routes/wishlist');
const kupovinaRouter = require('./routes/kupovina');
const ratingsRouter = require('./routes/ratings');
const komentariRouter = require('./routes/komentari');
const kompletirane_lekcijeRouter = require('./routes/kompletirane_lekcije');
const popustiRouter = require('./routes/popusti');
const rezultatiKvizaRouter = require('./routes/rezultati_kviza');
const placanjeRouter = require('./routes/placanje');
const webhooksRouter = require('./routes/webhooks');
const sekcijeRouter = require('./routes/sekcije');

const app = express();
const port = process.env.PORT || 5000;

// === Middleware ===

const allowedOrigins = [
    'http://localhost:3000',
    'https://learningplatform1.netlify.app' // Vaš produkcioni domen
];
app.use(cors({ origin: allowedOrigins }));

// Definišemo webhook rutu na poseban način.
// Prvo ide putanja, zatim SPECIJALNI `raw` parser, i tek onda `webhooksRouter`.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

// Sada definišemo globalne parsere za sve ostale rute
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sve ostale API rute
app.use('/api/auth', authRouter);
app.use('/api/korisnici', korisniciRouter);
app.use('/api/kursevi', kurseviRouter);
app.use('/api/lekcije', lekcijeRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/kupovina', kupovinaRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/komentari', komentariRouter);
app.use('/api/kompletirane_lekcije', kompletirane_lekcijeRouter);
app.use('/api/popusti', popustiRouter);
app.use('/api/rezultati_kviza', rezultatiKvizaRouter);
app.use('/api/placanje', placanjeRouter);
app.use('/api/sekcije', sekcijeRouter);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
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
const kvizoviRouter = require('./routes/kvizovi');
const rezultatiKvizaRouter = require('./routes/rezultati_kviza');
const placanjeRouter = require('./routes/placanje');
const webhooksRouter = require('./routes/webhooks');
const sekcijeRouter = require('./routes/sekcije');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use('/api/webhooks', webhooksRouter);
// Definišemo listu dozvoljenih adresa
const allowedOrigins = [
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Dozvoli zahteve koji nemaju origin (npr. Postman, mobilne aplikacije)
        if (!origin) return callback(null, true);

        // Proveri da li je dolazeći origin na našoj listi dozvoljenih
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        
        return callback(null, true);
    }
}));
app.use(bodyParser.json());


// Routes
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
app.use('/api/kvizovi', kvizoviRouter);
app.use('/api/rezultati_kviza', rezultatiKvizaRouter);
app.use('/api/placanje', placanjeRouter);
app.use('/api/sekcije', sekcijeRouter);


// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

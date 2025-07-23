const express = require('express');
const router = express.Router();
const db = require('../db');
const { lemonSqueezySetup, createCheckout } = require('@lemonsqueezy/lemonsqueezy.js');

// Konfigurišemo biblioteku sa API ključem
lemonSqueezySetup({
  apiKey: process.env.LEMON_SQUEEZY_API_KEY,
});

router.post('/kreiraj-checkout', async (req, res) => {
    try {
        const { kurs_id, email, ime, prezime } = req.body;

        if (!kurs_id || !email || !ime || !prezime) {
            return res.status(400).json({ error: 'Sva polja su obavezna.' });
        }

        const query = 'SELECT lemon_squeezy_variant_id FROM kursevi WHERE id = ?';
        const [results] = await db.query(query, [kurs_id]);

        if (results.length === 0 || !results[0].lemon_squeezy_variant_id) {
            return res.status(404).json({ error: 'Kurs ili odgovarajuća varijanta proizvoda nisu pronađeni.' });
        }

        const variantId = results[0].lemon_squeezy_variant_id;
        const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
        
        console.log(`👉 Pokušavam kreirati checkout sa variantId=${variantId} i storeId=${storeId}`);

        // ISPRAVKA JE OVDE: storeId i variantId se prosleđuju kao prvi i drugi argument,
        // a ostatak podataka kao treći argument (objekat).
        const { data: checkout, error } = await createCheckout(storeId, variantId, {
            checkoutData: {
                email,
                name: `${ime} ${prezime}`,
            },
            custom: {
                kurs_id: String(kurs_id),
            },
        });

        if (error) {
            console.error("Greška od Lemon Squeezy-ja:", error);
            throw new Error(error.message); 
        }
        
        const checkoutUrl = checkout.data.attributes.url;
        res.json({ url: checkoutUrl });

    } catch (error) {
        console.error("Greška unutar try/catch bloka:", error);
        res.status(500).json({ error: 'Došlo je do greške na serveru.' });
    }
});

module.exports = router;
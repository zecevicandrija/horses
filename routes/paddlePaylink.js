// backend/routes/paddlePaylink.js

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Osnovni URL za Paddle Billing Sandbox API
const PADDLE_API_URL = 'https://sandbox-api.paddle.com';

router.post('/create-transaction', async (req, res) => {
    // Uzimamo podatke koje je poslao frontend
    const { priceId, userEmail } = req.body;

    if (!priceId) {
        return res.status(400).json({ error: 'Price ID is required.' });
    }

    try {
        // Kreiramo payload (telo zahteva) za Paddle API
        const payload = {
            items: [{ price_id: priceId, quantity: 1 }],
            // Ako imamo email korisnika, šaljemo ga da se polje automatski popuni
            customer: userEmail ? { email: userEmail } : undefined,
            // Možete dodati i druge opcije ovde, npr. custom_data
        };

        // Šaljemo POST zahtev Paddle-u da kreira transakciju
        const response = await axios.post(`${PADDLE_API_URL}/transactions`, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
                'Content-Type': 'application/json',
            }
        });

        // Ako je sve uspešno, Paddle će vratiti podatke o transakciji,
        // uključujući `checkout.url` koji šaljemo nazad frontendu.
        const checkoutUrl = response.data.data.checkout.url;

        if (checkoutUrl) {
            res.status(200).json({ url: checkoutUrl });
        } else {
            throw new Error('Checkout URL not found in Paddle response.');
        }

    } catch (error) {
        console.error('Paddle API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to create payment link.' });
    }
});

module.exports = router;
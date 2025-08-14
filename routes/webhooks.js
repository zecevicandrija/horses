// backend/routes/webhooks.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const generateRandomPassword = require('../utils/passwordGenerator');
const { Resend } = require('resend');
const crypto = require('crypto');

// Mapa tvojih planova za lako računanje trajanja pretplate
const PLAN_MAP = {
    'pri_01k2mcmvyc542sjay9hz1gvz9s': { name: 'Standard', months: 1 },
    'pri_01k2mcnd83jsvxf34xx3k59jtv': { name: 'Pro', months: 3 },
};

// --- Glavna funkcija za obradu uspešne transakcije ---
async function handleSuccessfulPurchase(transaction, connection) {
    if (!transaction?.customer?.email) {
        console.warn(`Transakcija ${transaction.id} nema email kupca. Preskače se.`);
        return;
    }
    
    const customerEmail = transaction.customer.email.toLowerCase();
    const customerName = transaction.customer.name || 'Korisnik';
    const kursId = 1; // Fiksni ID za tvoj kurs
    
    // Izračunavanje datuma isteka na osnovu kupljenog plana
    let expiryDate = new Date();
    const priceId = transaction.items?.[0]?.price_id;
    if (priceId && PLAN_MAP[priceId]) {
        expiryDate.setMonth(expiryDate.getMonth() + PLAN_MAP[priceId].months);
    } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1); // Fallback na 1 mesec
        console.warn(`Price ID '${priceId}' nije u PLAN_MAP. Postavljen fallback na 1 mesec.`);
    }
    
    // Provera da li korisnik postoji (UPSERT logika)
    const [existingUsers] = await connection.query('SELECT id FROM korisnici WHERE email = ?', [customerEmail]);
    let userId;

    if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
        await connection.query('UPDATE korisnici SET subscription_expires_at = ? WHERE id = ?', [expiryDate, userId]);
        console.log(`Ažuriran postojeći korisnik (ID=${userId}) sa novim datumom isteka: ${expiryDate.toISOString()}`);
    } else {
        const password = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(password, 10);
        const [ime, ...prezimeParts] = customerName.split(' ');
        const prezime = prezimeParts.join(' ') || ime;

        const [newUserResult] = await connection.query(
            'INSERT INTO korisnici (ime, prezime, email, sifra, uloga, subscription_expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [ime, prezime, customerEmail, hashedPassword, 'korisnik', expiryDate]
        );
        userId = newUserResult.insertId;
        console.log(`Kreiran novi korisnik ID=${userId}, email=${customerEmail}, pretplata ističe=${expiryDate.toISOString()}`);
        
        // Slanje email-a dobrodošlice
        try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
                from: 'MotionAcademy <office@motionakademija.com>',
                to: customerEmail,
                subject: 'Dobrodošli u Motion Akademiju!',
                html: `<p>Vaši podaci za prijavu:</p><p>Email: ${customerEmail}</p><p>Lozinka: <strong>${password}</strong></p>`
            });
        } catch (emailError) {
            console.error("Greška pri slanju email-a:", emailError);
        }
    }

    // DODELA PRISTUPA KURSU: Upis u `kupovina` tabelu
    await connection.query('INSERT INTO kupovina (korisnik_id, kurs_id) VALUES (?, ?)', [userId, kursId]);
    console.log(`Korisniku ID ${userId} je dodeljen pristup kursu ID ${kursId}.`);
    
    // Upis u `transakcije` tabelu
    await connection.query(
        'INSERT INTO transakcije (provider_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            transaction.id, userId, kursId, 
            (transaction.details.totals.total / 100), 
            transaction.currency_code, transaction.status, 
            JSON.stringify(transaction)
        ]
    );
}


// --- Glavni Webhook Ruter ---
router.post('/paddle', async (req, res) => {
    console.log('--- Webhook ruta POKRENUTA ---');
    console.log('Da li req.rawBody postoji?', !!req.rawBody);
    const signatureHeader = req.get('Paddle-Signature') || '';
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    const rawBody = req.body;  // Koristimo req.rawBody koji smo sačuvali u index.js

    if (!rawBody || !webhookSecret || !signatureHeader) {
        return res.status(400).send('Verification data missing.');
    }

    try {
        // RUČNA VERIFIKACIJA POTPISA
        const parts = signatureHeader.split(';').reduce((acc, part) => {
            const [key, value] = part.split('=');
            if (key && value) acc[key.trim()] = value.trim();
            return acc;
        }, {});
        const timestamp = parts['ts'];
        const signature = parts['h1'];
        if (!timestamp || !signature) throw new Error('Timestamp ili potpis nedostaju.');
        const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(signedPayload);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== signature) {
            console.error('❌ Potpisi se ne poklapaju! Proveri PADDLE_WEBHOOK_SECRET.');
            return res.status(400).send('Signature mismatch.');
        }

        console.log('✅ Potpis je validan! Webhook je autentičan.');
        
        const eventType = event.event_type;
        
        res.status(200).send('Webhook successfully verified.');
        const event = JSON.parse(rawBody.toString('utf8'));
        
        // Obrada u pozadini
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            switch (eventType) {
                case 'transaction.completed':
                    await handleSuccessfulPurchase(event.data, connection);
                    break;
                // Ovde možeš dodati logiku za druge događaje ako ti zatrebaju
                default:
                    console.log(`Događaj '${eventType}' primljen i verifikovan, ali se ignoriše.`);
            }
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            console.error('Greška pri obradi događaja u bazi:', err);
        } finally {
            if (connection) connection.release();
        }

    } catch (error) {
        console.error('🔴 Greška pri ručnoj verifikaciji:', error.message);
        return res.status(400).send('Webhook processing failed.');
    }
});

module.exports = router;
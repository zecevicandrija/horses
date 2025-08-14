// backend/routes/webhooks.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const generateRandomPassword = require('../utils/passwordGenerator');
const { Resend } = require('resend');
const crypto = require('crypto');

const PLAN_MAP = {
    'pri_01k2mcmvyc542sjay9hz1gvz9s': { name: 'Standard', months: 1 },
    'pri_01k2mcnd83jsvxf34xx3k59jtv': { name: 'Pro', months: 3 },
};

async function handleSuccessfulPurchase(transaction, connection) {
    if (!transaction?.customer?.email) return;

    const customerEmail = transaction.customer.email.toLowerCase();
    const customerName = transaction.customer.name || 'Korisnik';
    const kursId = 1;

    let expiryDate = new Date();
    const priceId = transaction.items?.[0]?.price_id;
    expiryDate.setMonth(expiryDate.getMonth() + (PLAN_MAP[priceId]?.months || 1));

    const [existingUsers] = await connection.query('SELECT id FROM korisnici WHERE email = ?', [customerEmail]);
    let userId;

    if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
        await connection.query('UPDATE korisnici SET subscription_expires_at = ? WHERE id = ?', [expiryDate, userId]);
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

    await connection.query('INSERT INTO kupovina (korisnik_id, kurs_id) VALUES (?, ?)', [userId, kursId]);

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

router.post('/paddle', async (req, res) => {
    const rawBody = req.body; // Express raw middleware će ovo biti Buffer
    const signatureHeader = req.get('Paddle-Signature') || '';
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

    if (!rawBody || !webhookSecret || !signatureHeader) {
        return res.status(400).send('Verification data missing.');
    }

    try {
        const parts = signatureHeader.split(';').reduce((acc, part) => {
            const [key, value] = part.split('=');
            if (key && value) acc[key.trim()] = value.trim();
            return acc;
        }, {});
        const timestamp = parts['ts'];
        const signature = parts['h1'];
        const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;

        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(signedPayload);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== signature) {
            return res.status(400).send('Signature mismatch.');
        }

        const event = JSON.parse(rawBody.toString('utf8'));
        res.status(200).send('OK');

        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            if (event.event_type === 'transaction.completed') {
                await handleSuccessfulPurchase(event.data, connection);
            }
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            console.error('DB Error:', err);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(400).send('Webhook processing failed.');
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const generateRandomPassword = require('../utils/passwordGenerator');
const { Resend } = require('resend');
const { Paddle, EventName } = require('@paddle/paddle-node-sdk');

const paddle = new Paddle({
    apiKey: process.env.PADDLE_API_KEY
});

router.post('/paddle', async (req, res) => {
    const signature = req.get('Paddle-Signature');
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

    // Ključna izmena: Konvertujemo Buffer u string
    const rawRequestBody = req.body.toString('utf8');

    let connection;
    let event;

    try {
        // Prosleđujemo string umesto sirovog body-ja
        event = paddle.webhooks.unmarshal(rawRequestBody, webhookSecret, signature);
        console.log(`✅ Primljen Paddle događaj: ${event.eventType}`);

    } catch (err) {
        console.error('❌ Neuspešna verifikacija webhooka:', err.message);
        return res.status(400).send('Webhook signature verification failed.');
    }

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        switch (event.eventType) {
            case EventName.TransactionCompleted:
                const transaction = event.data;
                const customerId = transaction.customer_id;
                const customerEmail = transaction.customer.email.toLowerCase();
                const customerName = transaction.customer.name || 'Korisnik';
                const kursId = 1; // Fiksno za sada

                let expiryDate = new Date();
                const billingPeriod = transaction.items[0].price.billing_cycle;
                
                if (billingPeriod && billingPeriod.interval === 'month') {
                    expiryDate.setMonth(expiryDate.getMonth() + billingPeriod.frequency);
                } else if (billingPeriod && billingPeriod.interval === 'year') {
                    expiryDate.setFullYear(expiryDate.getFullYear() + billingPeriod.frequency);
                } else {
                    expiryDate.setFullYear(expiryDate.getFullYear() + 100);
                }

                const [existingUsers] = await connection.query('SELECT id FROM korisnici WHERE email = ?', [customerEmail]);
                let userId;

                if (existingUsers.length > 0) {
                    userId = existingUsers[0].id;
                    await connection.query(
                        'UPDATE korisnici SET subscription_expires_at = ?, paddle_customer_id = ? WHERE id = ?',
                        [expiryDate, customerId, userId]
                    );
                    console.log(`Pretplata za postojećeg korisnika (ID: ${userId}) je ažurirana.`);
                } else {
                    const password = generateRandomPassword();
                    const hashedPassword = await bcrypt.hash(password, 10);
                    const [ime, ...prezimeParts] = customerName.split(' ');
                    const prezime = prezimeParts.join(' ') || ime;

                    console.log(`Kreiranje novog korisnika. Email: ${customerEmail}`);

                    const [newUserResult] = await connection.query(
                        'INSERT INTO korisnici (ime, prezime, email, sifra, uloga, subscription_expires_at, paddle_customer_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [ime, prezime, customerEmail, hashedPassword, 'korisnik', expiryDate, customerId]
                    );
                    userId = newUserResult.insertId;

                    // Ovde ide vaša logika za slanje emaila dobrodošlice
                }

                await connection.query('INSERT INTO kupovina (korisnik_id, kurs_id) VALUES (?, ?)', [userId, kursId]);
                await connection.query(
                    'INSERT INTO transakcije (provider_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [transaction.id, userId, kursId, (transaction.details.totals.total / 100), transaction.currency_code, transaction.status, JSON.stringify(transaction)]
                );
                break;

            // Ovde možete dodati druge case-ove po potrebi
            
            default:
                console.log(`Primljen neobrađen događaj: ${event.eventType}`);
                break;
        }

        await connection.commit();
        res.status(200).send('Webhook uspešno obrađen.');

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Greška pri obradi događaja '${event?.eventType}':`, error);
        return res.status(500).send('Greška na serveru prilikom obrade webhooka.');
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
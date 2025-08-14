// backend/routes/webhooks.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const querystring = require('querystring');
const db = require('../db');
const generateRandomPassword = require('../utils/passwordGenerator');
const { Resend } = require('resend');
const { Paddle, EventName } = require('@paddle/paddle-node-sdk');

// Inicijalizacija Paddle SDK
const paddle = new Paddle({
    apiKey: process.env.PADDLE_API_KEY
});

router.post('/paddle', async (req, res) => {
    const signatureHeader = req.get('Paddle-Signature') || req.get('paddle-signature') || req.headers['paddle-signature'] || null;
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    const contentType = req.headers['content-type'] || '';

    // 1) Uzmi raw telo (Buffer -> string). Ako nije buffer, pokušaj fallback.
    let rawRequestBody = '';
    try {
        if (Buffer.isBuffer(req.body)) {
            rawRequestBody = req.body.toString('utf8');
        } else if (typeof req.body === 'string') {
            rawRequestBody = req.body;
        } else {
            // fallback - možda express.json/urlencoded je već parsirao, ali očekujemo raw
            try {
                rawRequestBody = JSON.stringify(req.body);
            } catch (e) {
                rawRequestBody = '';
            }
        }
    } catch (err) {
        console.error('Greška pri čitanju rawRequestBody:', err);
    }

    console.log('--- Paddle webhook headers ---', {
        signatureHeader: !!signatureHeader,
        webhookSecretSet: !!webhookSecret,
        contentType
    });

    // Prikaži prvih 2000 karaktera raw payload-a radi debug-a
    console.log('--- rawRequestBody (start, max 2000 chars) ---');
    console.log(rawRequestBody ? rawRequestBody.slice(0, 2000) : '<pražan payload>');

    let connection = null;
    let event = null;

    // Pokušavamo nekoliko varijanti parsiranja/poziva unmarshal:
    const parseAttempts = [];

    // 1) RAW string pokušaj
    parseAttempts.push({
        label: 'rawString_with_signatureHeader',
        input: rawRequestBody,
        signatureArg: signatureHeader
    });

    // 2) Ako je urlencoded -> parse u objekat
    try {
        const parsedQS = querystring.parse(rawRequestBody);
        parseAttempts.push({
            label: 'urlencoded_parsed_object',
            input: parsedQS,
            signatureArg: null
        });
    } catch (e) {
        // ignore
    }

    // 3) Pokušaj JSON parse (u slučaju da Paddle šalje JSON)
    try {
        const parsedJson = JSON.parse(rawRequestBody);
        parseAttempts.push({
            label: 'json_parsed_object',
            input: parsedJson,
            signatureArg: null
        });
    } catch (e) {
        // ignore
    }

    // 4) Ako req.body već sadrži parsed objekt (fallback)
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        parseAttempts.push({
            label: 'express_parsed_req_body',
            input: req.body,
            signatureArg: null
        });
    }

    // Iterativno pokušavamo da unmarshall-ujemo sa različitim inputima
    let lastError = null;
    for (const attempt of parseAttempts) {
        try {
            console.log(`Pokušaj unmarshal - način: ${attempt.label}`);
            // Pokušaj odgovarajućih signatura - SDK očekuje ili raw string + secret + signatureHeader
            // ili parsed object + secret (zavisno od implementacije SDK-a).
            if (attempt.signatureArg) {
                // ako imamo signature header, prosledimo ga (neke verzije SDK očekuju tri arg)
                event = paddle.webhooks.unmarshal(attempt.input, webhookSecret, attempt.signatureArg);
            } else {
                // pokušaćemo sa parsed object i samo secret
                event = paddle.webhooks.unmarshal(attempt.input, webhookSecret);
            }

            // Ako event ima keys -> dobro
            if (event && typeof event === 'object' && Object.keys(event).length > 0) {
                console.log(`unmarshal uspešan koristeći ${attempt.label}`);
                break;
            } else {
                // SDK vratio prazan objekat - zabeleži i nastavi dalje
                console.warn(`unmarshal vratio prazan objekat za ${attempt.label}`);
                // reset event da pokušamo dalje
                event = null;
            }
        } catch (err) {
            lastError = err;
            console.warn(`unmarshal error za ${attempt.label}:`, err && err.message ? err.message : err);
            event = null;
        }
    }

    if (!event) {
        console.error('❌ Nije moguće parsirati webhook payload: event ostaje prazno nakon svih pokušaja.');
        if (lastError) console.error('Poslednja greška unmarshal-a:', lastError);
        // Vrati 400 da Paddle (ili ti) vidi da treba debug — možeš promeniti u 200 ako želiš da Paddle ne retry-uje.
        return res.status(400).send('Webhook parsing failed. Check server logs for raw payload.');
    }

    // fallback za izvlačenje eventType iz različitih polja
    const eventType = event.eventType || event.alertName || event.alert_name || (event.data && (event.data.eventType || event.data.alert_name || event.data.alertName)) || null;

    if (!eventType) {
        console.error('❌ Greška pri parsiranju webhooka: eventType / alert_name nedostaje. Ceo event:', JSON.stringify(event || {}, null, 2));
        return res.status(400).send('Webhook parsing failed - no event type.');
    }

    // Odgovaramo odmah Paddle-u (200) jer je webhook validan i parsiran
    res.status(200).send('Webhook received and verified.');

    // --- Obrada događaja u pozadini (ista logika kao ranije) ---
    try {
        console.log(`Obrada događaja: ${eventType}`);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const normalizedEvent = String(eventType).toLowerCase();

        switch (normalizedEvent) {
            case (EventName.TransactionCompleted ? String(EventName.TransactionCompleted).toLowerCase() : 'transaction.completed'):
            case 'transaction.completed':
            case 'transaction_completed':
            case 'checkout_complete':
                {
                    const transaction = event.data || event;
                    const customerEmail =
                        (transaction.customer && transaction.customer.email) ||
                        transaction.email ||
                        transaction.payer_email ||
                        transaction.user_email ||
                        transaction.customer_email ||
                        null;

                    const customerName =
                        (transaction.customer && transaction.customer.name) ||
                        transaction.name ||
                        transaction.payer_name ||
                        transaction.customer_name ||
                        'Korisnik';

                    const customerId = transaction.customer_id || transaction.checkout_id || transaction.user_id || null;

                    if (!customerEmail) {
                        console.warn(`Događaj ${eventType} nema email kupca. Preskačem kreiranje naloga.`);
                        break;
                    }

                    const kursId = 1;
                    let expiryDate = new Date();

                    try {
                        const billingPeriod = transaction.items && transaction.items[0] && (transaction.items[0].price && transaction.items[0].price.billing_cycle);
                        const altBilling = transaction.subscription || transaction.subscription_plan || transaction.billing || null;

                        if (billingPeriod && billingPeriod.interval) {
                            if (billingPeriod.interval === 'month') {
                                const freq = parseInt(billingPeriod.frequency || 1, 10) || 1;
                                expiryDate.setMonth(expiryDate.getMonth() + freq);
                            } else if (billingPeriod.interval === 'year') {
                                const freq = parseInt(billingPeriod.frequency || 1, 10) || 1;
                                expiryDate.setFullYear(expiryDate.getFullYear() + freq);
                            } else {
                                expiryDate.setFullYear(expiryDate.getFullYear() + 100);
                            }
                        } else if (altBilling && altBilling.interval) {
                            if (altBilling.interval.toLowerCase().includes('month')) {
                                expiryDate.setMonth(expiryDate.getMonth() + (parseInt(altBilling.frequency || 1, 10) || 1));
                            } else if (altBilling.interval.toLowerCase().includes('year')) {
                                expiryDate.setFullYear(expiryDate.getFullYear() + (parseInt(altBilling.frequency || 1, 10) || 1));
                            } else {
                                expiryDate.setFullYear(expiryDate.getFullYear() + 100);
                            }
                        } else {
                            expiryDate.setFullYear(expiryDate.getFullYear() + 100);
                        }
                    } catch (err) {
                        expiryDate = new Date();
                        expiryDate.setFullYear(expiryDate.getFullYear() + 100);
                    }

                    const [existingUsers] = await connection.query('SELECT id FROM korisnici WHERE email = ?', [customerEmail.toLowerCase()]);
                    let userId;

                    if (existingUsers && existingUsers.length > 0) {
                        userId = existingUsers[0].id;
                        await connection.query(
                            'UPDATE korisnici SET subscription_expires_at = ?, paddle_customer_id = ? WHERE id = ?',
                            [expiryDate, customerId, userId]
                        );
                        console.log(`Pretplata za postojećeg korisnika (ID: ${userId}) je uspešno ažurirana.`);
                    } else {
                        const password = generateRandomPassword();
                        const hashedPassword = await bcrypt.hash(password, 10);

                        const [ime, ...prezimeParts] = customerName.split(/\s+/);
                        const prezime = prezimeParts.join(' ') || ime;

                        const [newUserResult] = await connection.query(
                            'INSERT INTO korisnici (ime, prezime, email, sifra, uloga, subscription_expires_at, paddle_customer_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [ime, prezime, customerEmail.toLowerCase(), hashedPassword, 'korisnik', expiryDate, customerId]
                        );
                        userId = newUserResult.insertId;

                        const pismo = `
                          <div style="background-color:#121212;padding:40px 0;text-align:center;font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            <div style="max-width:500px;margin:0 auto;background-color:#1e1e1e;padding:30px;border-radius:12px;box-shadow:0 0 20px rgba(255, 60, 0, 0.5);">
                              <h1 style="color:#ff3c00;margin-bottom:20px;">Dobrodošao, ${ime}!</h1>
                              <p style="color:#ffffff;font-size:16px;margin-bottom:30px;">Hvala ti što si se pridružio Motion Akademiji. Tvoj nalog je uspešno kreiran i spreman za korišćenje.</p>
                              <div style="text-align:left;background:#121212;padding:20px;border-radius:8px;border:1px solid #ff3c00;color:#fff;">
                                <p style="margin:0 0 10px;"><strong>Email:</strong> ${customerEmail}</p>
                                <p style="margin:0;"><strong>Lozinka:</strong> <span style="color:#ff3c00;">${password}</span></p>
                              </div>
                              <div style="margin-top:20px; text-align:left;background:#121212;padding:20px;border-radius:8px;border:1px solid #ff3c00;color:#fff;">
                                <p style="margin:0 0 10px;"><strong>Link za prijavu:</strong> https://motionakademija.com/login</p>
                                <p style="margin:0;"><strong>Discord:</strong> <span style="color:#ff3c00;">https://discord.gg/filipmotion</span></p>
                              </div>
                              <p style="color:#888;margin-top:30px;font-size:12px;">Savet: Nakon prijave, možeš odmah da promeniš svoju lozinku u podešavanjima profila.</p>
                            </div>
                          </div>
                        `;

                        try {
                            if (process.env.RESEND_API_KEY) {
                                const resend = new Resend(process.env.RESEND_API_KEY);
                                await resend.emails.send({
                                    from: 'MotionAcademy <office@motionakademija.com>',
                                    to: customerEmail,
                                    subject: 'Dobrodošli u Motion Akademiju! Vaš nalog je kreiran.',
                                    html: pismo
                                });
                                console.log(`Email dobrodošlice poslat na ${customerEmail}`);
                            } else {
                                console.warn('RESEND_API_KEY nije postavljen — preskačem slanje email-a.');
                            }
                        } catch (emailError) {
                            console.error('Greška prilikom slanja email-a:', emailError);
                        }
                    }

                    // Unos u kupovina i transakcije
                    try {
                        await connection.query('INSERT INTO kupovina (korisnik_id, kurs_id) VALUES (?, ?)', [userId, kursId]);

                        let iznos = null;
                        let valuta = transaction.currency || transaction.currency_code || null;
                        if (transaction.details && transaction.details.totals && transaction.details.totals.total) {
                            iznos = parseFloat(transaction.details.totals.total);
                        } else if (transaction.total) {
                            iznos = parseFloat(transaction.total);
                        } else if (transaction.amount) {
                            iznos = parseFloat(transaction.amount);
                        }

                        await connection.query(
                            'INSERT INTO transakcije (provider_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [
                                transaction.id || transaction.checkout_id || null,
                                userId,
                                kursId,
                                iznos,
                                valuta,
                                transaction.status || transaction.payment_status || 'unknown',
                                JSON.stringify(transaction)
                            ]
                        );
                        console.log(`Uspešno obrađen događaj ${eventType} za korisnika ID: ${userId}`);
                    } catch (txErr) {
                        console.error('Greška pri upisu u kupovina/transakcije:', txErr);
                        throw txErr;
                    }

                    break;
                }
            default:
                console.log(`Događaj '${eventType}' je primljen i verifikovan, ali se ignoriše (nema handler).`);
                break;
        }

        await connection.commit();
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (rbErr) { console.error('Rollback error:', rbErr); }
        }
        console.error(`Greška pri OBRADI događaja u pozadini '${event && event.eventType ? event.eventType : 'unknown'}':`, error);
    } finally {
        if (connection) {
            try { connection.release(); } catch (releaseErr) { console.error('Error releasing DB connection:', releaseErr); }
        }
    }
});

module.exports = router;

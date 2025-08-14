// backend/routes/webhooks.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const generateRandomPassword = require('../utils/passwordGenerator');
const { Resend } = require('resend');
const { Paddle, EventName } = require('@paddle/paddle-node-sdk');

// Inicijalizacija Paddle SDK sa vašim API ključem iz .env fajla
const paddle = new Paddle({
    apiKey: process.env.PADDLE_API_KEY
});

// Ruta očekuje raw body (Buffer) - postaraj se da u index.js koristiš express.raw za ovaj path
router.post('/paddle', async (req, res) => {
    const signature = req.get('Paddle-Signature') || req.get('paddle-signature') || req.headers['paddle-signature'];
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

    // Pretvorimo req.body (Buffer) u string na siguran način
    let rawRequestBody;
    if (Buffer.isBuffer(req.body)) {
        rawRequestBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
        rawRequestBody = req.body;
    } else {
        // fallback (ne bi trebalo da se desi ako koristimo express.raw)
        try {
            rawRequestBody = JSON.stringify(req.body);
        } catch (e) {
            rawRequestBody = '';
        }
    }

    let connection = null;
    let event = null;

    try {
        // 1) Verifikujemo i parsiramo webhook koristeći Paddle SDK
        event = paddle.webhooks.unmarshal(rawRequestBody, webhookSecret, signature);
    } catch (err) {
        console.error('❌ Neuspešna verifikacija webhooka:', err?.message || err);
        // Vratimo 400: Paddle neće retry ako potpis nije validan
        return res.status(400).send('Webhook signature verification failed.');
    }

    // Debug logovi (privremeno - možeš smanjiti nivo logovanja kasnije)
    console.log('--- Paddle webhook headers ---', {
        signatureHeader: !!signature,
        webhookSecretSet: !!webhookSecret
    });
    try {
        console.log('--- Parsed event (top-level) ---', {
            eventType: event && (event.eventType || event.alertName || event.alert_name),
            keys: event ? Object.keys(event) : null
        });
    } catch (e) {
        console.log('Ne mogu da logujem event:', e);
    }

    // Ako nema jasnog polja eventType, pokušamo fallback polja
    const eventType = (event && (event.eventType || event.alertName || event.alert_name)) ||
                      (event && event.data && (event.data.eventType || event.data.alert_name || event.data.alertName)) ||
                      null;

    if (!event || !eventType) {
        console.error('❌ Greška pri parsiranju webhooka: eventType / alert_name nedostaje. Ceo event:', JSON.stringify(event || {}, null, 2));
        return res.status(400).send('Webhook parsing failed.');
    }

    // Odmah odgovorimo Paddle-u da je webhook primljen (da ne čeka)
    res.status(200).send('Webhook received and verified.');

    // --- Nastavljamo obradu u pozadini ---
    try {
        console.log(`Obrada događaja: ${eventType}`);

        // Otvorimo konekciju i transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Normalizujemo eventType na lower-case radi poređenja
        const normalizedEvent = String(eventType).toLowerCase();

        switch (normalizedEvent) {
            case (EventName.TransactionCompleted ? String(EventName.TransactionCompleted).toLowerCase() : 'transaction.completed'):
            case 'transaction.completed':
            case 'transaction_completed':
            case 'checkout_complete':
                {
                    // transaction info može biti u event.data ili direktno u event
                    const transaction = event.data || event;

                    // Pokušamo da izvucemo podatke o kupcu robustno
                    const customerEmail =
                        (transaction.customer && transaction.customer.email) ||
                        transaction.email ||
                        transaction.payer_email ||
                        transaction.user_email ||
                        transaction.customer_email ||
                        (transaction.customer && transaction.customer.email_address) ||
                        null;

                    const customerName =
                        (transaction.customer && transaction.customer.name) ||
                        transaction.name ||
                        transaction.payer_name ||
                        transaction.customer_name ||
                        'Korisnik';

                    const customerId = transaction.customer_id || transaction.checkout_id || transaction.user_id || null;

                    if (!customerEmail) {
                        console.warn(`Događaj ${eventType} nema email kupca. ID transakcije: ${transaction.id || transaction.checkout_id || 'nepoznato'}. Preskačem kreiranje naloga.`);
                        break;
                    }

                    const kursId = 1; // fiksno jer imaš samo jedan kurs u bazi

                    // Izračunavanje expiryDate na osnovu billing ciklusa (ako postoji)
                    let expiryDate = new Date();
                    try {
                        const billingPeriod = transaction.items && transaction.items[0] && (transaction.items[0].price && transaction.items[0].price.billing_cycle);
                        // fallback: paddle može imati drugi oblik, pa probamo transaction.subscription_billing or transaction.subscription
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
                            // alternativna logika
                            if (altBilling.interval.toLowerCase().includes('month')) {
                                expiryDate.setMonth(expiryDate.getMonth() + (parseInt(altBilling.frequency || 1, 10) || 1));
                            } else if (altBilling.interval.toLowerCase().includes('year')) {
                                expiryDate.setFullYear(expiryDate.getFullYear() + (parseInt(altBilling.frequency || 1, 10) || 1));
                            } else {
                                expiryDate.setFullYear(expiryDate.getFullYear() + 100);
                            }
                        } else {
                            // ako nema billing info -> dodelimo "veliku" vrednost
                            expiryDate.setFullYear(expiryDate.getFullYear() + 100);
                        }
                    } catch (err) {
                        expiryDate = new Date();
                        expiryDate.setFullYear(expiryDate.getFullYear() + 100);
                    }

                    // Proveravamo da li korisnik već postoji
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
                        // kreiramo novog korisnika
                        const password = generateRandomPassword();
                        const hashedPassword = await bcrypt.hash(password, 10);

                        // podela imena (prvi deo -> ime, ostatak -> prezime)
                        const [ime, ...prezimeParts] = customerName.split(/\s+/);
                        const prezime = prezimeParts.join(' ') || ime;

                        console.log(`Kreiranje novog korisnika. Email: ${customerEmail}`);

                        const [newUserResult] = await connection.query(
                            'INSERT INTO korisnici (ime, prezime, email, sifra, uloga, subscription_expires_at, paddle_customer_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [ime, prezime, customerEmail.toLowerCase(), hashedPassword, 'korisnik', expiryDate, customerId]
                        );
                        userId = newUserResult.insertId;

                        // Priprema HTML email-a
                        const pismo = `
                          <div style="background-color:#121212;padding:40px 0;text-align:center;font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            <div style="max-width:500px;margin:0 auto;background-color:#1e1e1e;padding:30px;border-radius:12px;box-shadow:0 0 20px rgba(255, 60, 0, 0.5);">
                              <h1 style="color:#ff3c00;margin-bottom:20px;">Dobrodošao, ${ime}!</h1>
                              <p style="color:#ffffff;font-size:16px;margin-bottom:30px;">
                                Hvala ti što si se pridružio Motion Akademiji. Tvoj nalog je uspešno kreiran i spreman za korišćenje.
                              </p>
                              <div style="text-align:left;background:#121212;padding:20px;border-radius:8px;border:1px solid #ff3c00;color:#fff;">
                                <p style="margin:0 0 10px;"><strong>Email:</strong> ${customerEmail}</p>
                                <p style="margin:0;"><strong>Lozinka:</strong> <span style="color:#ff3c00;">${password}</span></p>
                              </div>
                              <div style="margin-top:20px; text-align:left;background:#121212;padding:20px;border-radius:8px;border:1px solid #ff3c00;color:#fff;">
                                <p style="margin:0 0 10px;"><strong>Link za prijavu:</strong> https://motionakademija.com/login</p>
                                <p style="margin:0;"><strong>Discord:</strong> <span style="color:#ff3c00;">https://discord.gg/filipmotion</span></p>
                              </div>
                              <p style="color:#888;margin-top:30px;font-size:12px;">
                                Savet: Nakon prijave, možeš odmah da promeniš svoju lozinku u podešavanjima profila.
                              </p>
                            </div>
                          </div>
                        `;

                        // Saljemo email preko Resend (ako je API ključ postavljen)
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

                    // Unos u kupovina i transakcije (prilagodjeno poljima koja možda postoje)
                    try {
                        await connection.query('INSERT INTO kupovina (korisnik_id, kurs_id) VALUES (?, ?)', [userId, kursId]);

                        // izvlacimo iznos i valutu na siguran nacin
                        let iznos = null;
                        let valuta = transaction.currency || transaction.currency_code || transaction.currency || transaction.currency_code;
                        if (transaction.details && transaction.details.totals && transaction.details.totals.total) {
                            iznos = parseFloat(transaction.details.totals.total);
                        } else if (transaction.total) {
                            iznos = parseFloat(transaction.total);
                        } else if (transaction.amount) {
                            iznos = parseFloat(transaction.amount);
                        } else if (transaction.items && transaction.items[0] && transaction.items[0].price && transaction.items[0].price.amount) {
                            iznos = parseFloat(transaction.items[0].price.amount);
                        }

                        // Ako Paddle vraca u centima, proveri da li vrednosti izgledaju kao veliki brojevi i podeli sa 100.
                        if (iznos && iznos > 1000) {
                            // NE automatski delimo, ovo je heuristika — prilagodi ako znaš tačan format od Paddle-a
                            // iznos = iznos / 100;
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
            try {
                await connection.rollback();
            } catch (rbErr) {
                console.error('Rollback error:', rbErr);
            }
        }
        console.error(`Greška pri OBRADI događaja u pozadini '${eventType}':`, error);
    } finally {
        if (connection) {
            try {
                connection.release();
            } catch (releaseErr) {
                console.error('Error releasing DB connection:', releaseErr);
            }
        }
    }
});

module.exports = router;

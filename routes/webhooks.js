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

// Middleware za sirov body se primenjuje na nivou aplikacije (u index.js),
// tako da ga ovde ne treba ponovo definisati.

router.post('/paddle', async (req, res) => {
    // Logika adaptirana iz GitHub primera
    const signature = req.get('Paddle-Signature') || '';
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    // Telo zahteva (Buffer) konvertujemo u string, kao u primeru
    const rawRequestBody = req.body.toString('utf8');

    let connection;
    
    try {
        // Proveravamo da li imamo potpis i telo zahteva pre nastavka
        if (signature && rawRequestBody) {
            
            // Unutar ovog bloka pokušavamo da verifikujemo potpis i obradimo događaj
            const event = await paddle.webhooks.unmarshal(rawRequestBody, webhookSecret, signature);
            console.log(`✅ Potpis verifikovan. Primljen događaj: ${event.eventType}`);

            // Otvaramo konekciju ka bazi i započinjemo transakciju
            connection = await db.getConnection();
            await connection.beginTransaction();
            
            // Obrada različitih vrsta događaja
            switch (event.eventType) {
                
                case EventName.TransactionCompleted:
                    const transaction = event.data;
                    const customerId = transaction.customer_id;
                    const customerEmail = transaction.customer.email.toLowerCase();
                    const customerName = transaction.customer.name || 'Korisnik';
                    const kursId = 1; // Fiksna vrednost jer imate jedan kurs

                    let expiryDate = new Date();
                    const billingPeriod = transaction.items[0].price.billing_cycle;
                    
                    if (billingPeriod && billingPeriod.interval === 'month') {
                        expiryDate.setMonth(expiryDate.getMonth() + billingPeriod.frequency);
                    } else if (billingPeriod && billingPeriod.interval === 'year') {
                        expiryDate.setFullYear(expiryDate.getFullYear() + billingPeriod.frequency);
                    } else {
                        // Ako nije pretplata (billing_cycle je null), dajemo doživotni pristup
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
                        console.log(`Pretplata za postojećeg korisnika (ID: ${userId}) je uspešno ažurirana.`);
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

                        // Kompletna logika za slanje email-a dobrodošlice
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
                        try {
                            const resend = new Resend(process.env.RESEND_API_KEY);
                            await resend.emails.send({
                                from: 'MotionAcademy <office@motionakademija.com>',
                                to: customerEmail,
                                subject: 'Dobrodošli u Motion Akademiju! Vaš nalog je kreiran.',
                                html: pismo
                            });
                            console.log(`Email dobrodošlice poslat na ${customerEmail}`);
                        } catch (emailError) {
                            console.error("Greška prilikom slanja email-a:", emailError);
                        }
                    }

                    await connection.query('INSERT INTO kupovina (korisnik_id, kurs_id) VALUES (?, ?)', [userId, kursId]);
                    await connection.query(
                        'INSERT INTO transakcije (provider_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [transaction.id, userId, kursId, (transaction.details.totals.total / 100), transaction.currency_code, transaction.status, JSON.stringify(transaction)]
                    );
                    console.log(`Uspešno obrađen događaj ${event.eventType} za korisnika ID: ${userId}`);
                    break;

                case EventName.SubscriptionCanceled:
                    const subscriptionCanceled = event.data;
                    const customerIdToCancel = subscriptionCanceled.customer_id;
                    const finalExpiryDate = new Date(subscriptionCanceled.current_billing_period.ends_at);

                    await connection.query(
                        'UPDATE korisnici SET subscription_expires_at = ? WHERE paddle_customer_id = ?',
                        [finalExpiryDate, customerIdToCancel]
                    );
                    console.log(`Pretplata za korisnika sa paddle_customer_id ${customerIdToCancel} je otkazana i ističe ${finalExpiryDate.toISOString()}`);
                    break;
                
                default:
                    console.log(`Događaj '${event.eventType}' je primljen i verifikovan, ali se ignoriše.`);
                    break;
            }
            
            await connection.commit();
            
        } else {
            console.warn("Webhook primljen, ali nedostaje potpis ili telo zahteva.");
            return res.status(400).send('Signature or body missing.');
        }

    } catch (error) {
        // Ovaj catch blok hvata greške iz unmarshal-a ili iz obrade u bazi
        console.error('❌ Došlo je do greške u webhook handleru:', error.message);
        if (connection) await connection.rollback(); // Poništi transakciju ako je došlo do greške
        return res.status(400).send('Webhook processing failed.');
    } finally {
        if (connection) connection.release();
    }

    // Vraćamo odgovor na kraju da potvrdimo prijem, kao u GitHub primeru
    return res.status(200).send('Webhook processed.');
});

module.exports = router;
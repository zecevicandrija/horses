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

// Ovaj middleware je OBAVEZAN da bismo dobili sirovi ("raw") body
// zahteva za verifikaciju Paddle potpisa.
//router.use(express.raw({ type: 'application/json' }));

router.post('/paddle', async (req, res) => {
    // Čitamo potpis iz header-a i sirovi body iz zahteva
    const signature = req.get('Paddle-Signature');
    const rawBody = req.body;
    const webhookSecret = 'pdl_ntfset_01k2mfztpz8j5nw5fhgc2esm8j_OhwO8FqJPUeyxr6zJdKFjajjOBhG8mjI'; // Vaš webhook secret iz Paddle dashboarda

    let connection;
    let event;

    try {
        // 1. Verifikacija da li je zahtev zaista stigao od Paddle-a
        // Ako potpis nije validan, baciće grešku i izvršenje će se prekinuti.
        event = paddle.webhooks.unmarshal(rawBody, signature, webhookSecret);
        console.log(`✅ Primljen Paddle događaj: ${event.eventType}`);

    } catch (err) {
        console.warn('❌ Neuspešna verifikacija webhooka:', err.message);
        return res.status(400).send('Webhook signature verification failed.');
    }

    try {
        // Otvaramo konekciju ka bazi i započinjemo transakciju
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 2. Obrada različitih vrsta događaja
        switch (event.eventType) {
            
            // --- Događaj: Transakcija je uspešno naplaćena ---
            // Ovo se dešava i za prvu kupovinu i za svaku obnovu pretplate.
            case EventName.TransactionCompleted:
                const transaction = event.data;
                const customerId = transaction.customer_id;
                const customerEmail = transaction.customer.email.toLowerCase();
                const customerName = transaction.customer.name || 'Korisnik';

                // Pretpostavka je da imate samo jedan glavni kurs (ID = 1).
                // U budućnosti, ovo možete povezati preko custom data u transakciji
                // ili tako što ćete imati mapu Price ID-jeva i ID-jeva kurseva.
                const kursId = 1;

                // Računanje datuma isteka na osnovu kupljenog plana
                let expiryDate = new Date();
                const billingPeriod = transaction.items[0].price.billing_cycle; // npr. { interval: 'month', frequency: 1 }
                
                if (billingPeriod.interval === 'month') {
                    expiryDate.setMonth(expiryDate.getMonth() + billingPeriod.frequency);
                } else if (billingPeriod.interval === 'year') {
                    expiryDate.setFullYear(expiryDate.getFullYear() + billingPeriod.frequency);
                } else {
                    // Ako nije pretplata, dajemo npr. doživotni pristup (ili fiksni period)
                    expiryDate.setFullYear(expiryDate.getFullYear() + 100);
                }

                // Provera da li korisnik već postoji
                const [existingUsers] = await connection.query('SELECT id FROM korisnici WHERE email = ?', [customerEmail]);
                let userId;

                if (existingUsers.length > 0) {
                    // KORISNIK POSTOJI - Ažuriramo mu datum isteka i paddle_customer_id (za svaki slučaj)
                    userId = existingUsers[0].id;
                    await connection.query(
                        'UPDATE korisnici SET subscription_expires_at = ?, paddle_customer_id = ? WHERE id = ?',
                        [expiryDate, customerId, userId]
                    );
                    console.log(`Pretplata za postojećeg korisnika (ID: ${userId}) je aktivirana/produžena do ${expiryDate.toISOString()}`);
                } else {
                    // KORISNIK NE POSTOJI - Kreiramo novi nalog
                    const password = generateRandomPassword();
                    const hashedPassword = await bcrypt.hash(password, 10);
                    const [ime, ...prezimeParts] = customerName.split(' ');
                    const prezime = prezimeParts.join(' ') || ime;

                    console.log(`Novi korisnik je kupio. Email: ${customerEmail}, generisana šifra: ${password}`);

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

                // Upis u 'kupovina' i 'transakcije' tabele
                await connection.query('INSERT INTO kupovina (korisnik_id, kurs_id) VALUES (?, ?)', [userId, kursId]);
                await connection.query(
                    'INSERT INTO transakcije (provider_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [transaction.id, userId, kursId, (transaction.details.totals.total / 100), transaction.currency_code, transaction.status, JSON.stringify(transaction)]
                );
                break;

            // --- Događaj: Pretplata je otkazana ---
            case EventName.SubscriptionCanceled:
                const subscriptionCanceled = event.data;
                const customerIdToCancel = subscriptionCanceled.customer_id;
                // Pretplata ističe na kraju trenutnog billing perioda
                const finalExpiryDate = new Date(subscriptionCanceled.current_billing_period.ends_at);

                await connection.query(
                    'UPDATE korisnici SET subscription_expires_at = ? WHERE paddle_customer_id = ?',
                    [finalExpiryDate, customerIdToCancel]
                );
                console.log(`Pretplata za korisnika sa paddle_customer_id ${customerIdToCancel} je otkazana i ističe ${finalExpiryDate.toISOString()}`);
                break;
                
            // Ovde možete dodati obradu za druge događaje po potrebi
            // case EventName.SubscriptionUpdated:
            // case EventName.SubscriptionPaused:
            // ... itd.
            
            default:
                console.log(`Primljen neobrađen događaj: ${event.eventType}`);
                break;
        }

        // Ako je sve prošlo kako treba, potvrđujemo transakciju
        await connection.commit();
        res.status(200).send('Webhook uspešno obrađen.');

    } catch (error) {
        // Ako se desi bilo kakva greška, poništavamo sve izmene u bazi
        if (connection) await connection.rollback();
        console.error(`Greška pri obradi događaja '${event?.eventType}':`, error);
        return res.status(500).send('Greška na serveru prilikom obrade webhooka.');
    } finally {
        // Na kraju, uvek oslobađamo konekciju
        if (connection) connection.release();
    }
});

module.exports = router;
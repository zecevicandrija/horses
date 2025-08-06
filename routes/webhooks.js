const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const generateRandomPassword = require('../utils/passwordGenerator');
const { Resend } = require('resend');

// Ovaj middleware je potreban da bismo dobili sirovi ("raw") body zahteva za verifikaciju
router.use(express.raw({ type: 'application/json' }));

// =======================================================================
// === FINALNI WEBHOOK HANDLER ZA PAYHIP ===
// =======================================================================
router.post('/payhip', async (req, res) => {
    // 1. Provera potpisa (Webhook verifikacija)
    const providedApiKey = req.get('payhip-api-key'); // Payhip šalje API ključ u ovom headeru
    if (providedApiKey !== process.env.PAYHIP_API_KEY) {
        console.warn('Neuspešna verifikacija webhooka: API ključ se ne poklapa.');
        return res.status(401).send('Invalid API Key.');
    }

    let connection;
    const payload = JSON.parse(req.body.toString());
    const eventType = payload.event_type; // npr. "subscription_created" ili "paid"

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // --- LOGIKA ZA PRVU KUPOVINU PRETPLATE ---
        if (eventType === 'subscription_created') {
            console.log('Primljen događaj: subscription_created');
            const customerEmail = payload.customer.email.toLowerCase();
            const customerName = payload.customer.name;
            const planId = payload.pricing_plan_id;
            const productId = payload.product_id;
            const orderId = payload.subscription_id;

            // Pronalazimo kurs na osnovu ID-ja proizvoda
            const [kursevi] = await connection.query('SELECT id FROM kursevi WHERE payhip_product_id = ?', [productId]);
            if (kursevi.length === 0) {
                throw new Error(`Kurs sa Payhip proizvod ID-jem ${productId} nije pronađen.`);
            }
            const kursId = kursevi[0].id;

            // Izračunavanje datuma isteka na osnovu kupljenog plana
            let expiryDate = new Date();
            if (planId === 'MrW69K77GN') { // Mesečni plan
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            } else if (planId === 'bZz20V8LGr') { // Tromesečni plan
                expiryDate.setMonth(expiryDate.getMonth() + 3);
            } else {
                throw new Error(`Nepoznat pricing_plan_id: ${planId}`);
            }

            // Provera da li korisnik već postoji
            const [existingUsers] = await connection.query('SELECT id FROM korisnici WHERE email = ?', [customerEmail]);
            let userId;

            if (existingUsers.length > 0) {
                // KORISNIK POSTOJI - AŽURIRAMO MU DATUM ISTEKA
                userId = existingUsers[0].id;
                await connection.query('UPDATE korisnici SET subscription_expires_at = ? WHERE id = ?', [expiryDate, userId]);
                console.log(`Pretplata za postojećeg korisnika (ID: ${userId}) je aktivirana/ažurirana do ${expiryDate.toISOString()}`);
            } else {
                // KORISNIK NE POSTOJI - KREIRAMO NOVI NALOG
                const password = generateRandomPassword();
                const hashedPassword = await bcrypt.hash(password, 10);
                const [ime, ...prezimeParts] = customerName.split(' ');
                const prezime = prezimeParts.join(' ') || ime;

                console.log(`Novi korisnik je kupio pretplatu. Email: ${customerEmail}, generisana šifra: ${password}`);

                const [newUserResult] = await connection.query(
                    'INSERT INTO korisnici (ime, prezime, email, sifra, uloga, subscription_expires_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [ime, prezime, customerEmail, hashedPassword, 'korisnik', expiryDate]
                );
                userId = newUserResult.insertId;

                // Slanje email-a dobrodošlice
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
                } catch (emailError) {
                    console.error("Greška prilikom slanja email-a:", emailError);
                }
            }

            // Upis u 'kupovina' i 'transakcije' tabele
            await connection.query('INSERT INTO kupovina (korisnik_id, kurs_id) VALUES (?, ?)', [userId, kursId]);
            await connection.query(
                'INSERT INTO transakcije (provider_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [orderId, userId, kursId, payload.price, payload.currency_code, 'paid', JSON.stringify(payload)]
            );

        // --- LOGIKA ZA AUTOMATSKU OBNOVU POSTOJEĆE PRETPLATE ---
        } else if (eventType === 'paid') {
            console.log('Primljen događaj: paid');
            // Ovaj događaj se okida za SVAKU naplatu. Mi ga koristimo za obnove.
            // Nećemo duplirati logiku, samo ćemo produžiti pretplatu.
            const customerEmail = payload.payer_email.toLowerCase();
            const [users] = await connection.query('SELECT id, subscription_expires_at FROM korisnici WHERE email = ?', [customerEmail]);

            if (users.length > 0) {
                const user = users[0];
                const userId = user.id;
                const currentExpiry = new Date(user.subscription_expires_at);
                const planId = payload.items[0]?.pricing_plan_id;

                // Ako je ovo prva "paid" notifikacija, datum isteka je već postavljen od strane 'subscription_created'.
                // Ako je obnova, datum isteka će biti u prošlosti ili blizu sadašnjosti.
                // Zato je najsigurnije da uvek produžavamo od TRENUTNOG datuma isteka.
                
                let newExpiryDate = (currentExpiry > new Date()) ? currentExpiry : new Date();

                if (planId === 'MrW69K77GN') {
                    newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
                } else if (planId === 'bZz20V8LGr') {
                    newExpiryDate.setMonth(newExpiryDate.getMonth() + 3);
                } else {
                    // Ako ne prepoznamo plan, ne radimo ništa da ne bismo napravili grešku
                    console.warn(`Obnova nije izvršena: Nepoznat pricing_plan_id u 'paid' događaju za korisnika ${customerEmail}`);
                }

                // Ažuriramo samo ako je novi datum kasniji od postojećeg, da ne bismo skratili pretplatu
                // ako stignu dva webhooka istovremeno.
                if (newExpiryDate > new Date(user.subscription_expires_at)) {
                    await connection.query('UPDATE korisnici SET subscription_expires_at = ? WHERE id = ?', [newExpiryDate, userId]);
                    console.log(`Pretplata za korisnika (ID: ${userId}) je obnovljena do ${newExpiryDate.toISOString()}`);
                }
            } else {
                console.warn(`Primljen 'paid' događaj za nepostojećeg korisnika: ${customerEmail}`);
            }
        }

        await connection.commit();
        res.status(200).send('Webhook uspešno obrađen.');

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Greška pri obradi događaja '${eventType}':`, error);
        return res.status(500).send('Greška na serveru prilikom obrade webhooka.');
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;

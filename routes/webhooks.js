const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const generateRandomPassword = require('../utils/passwordGenerator');
const { Resend } = require('resend');

router.use(express.raw({ type: 'application/json' }));

router.post('/lemon-squeezy', async (req, res) => {
    // 1. Provera potpisa (ostaje ista)
    try {
        const secret = process.env.LEMON_SQUEEZY_SIGNING_SECRET;
        const hmac = crypto.createHmac('sha256', secret);
        const digest = Buffer.from(hmac.update(req.body).digest('hex'), 'utf8');
        const signature = Buffer.from(req.get('X-Signature') || '', 'utf8');
        if (!crypto.timingSafeEqual(digest, signature)) {
            return res.status(400).send('Invalid signature.');
        }
    } catch (error) {
        console.error("Greška prilikom verifikacije potpisa:", error);
        return res.status(500).send('Greška na serveru.');
    }

    // 2. Obrada podataka
    const payload = JSON.parse(req.body.toString());
    const eventName = payload.meta.event_name;
    
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // --- GLAVNA LOGIKA ZA NOVU PORUDŽBINU (JEDNOKRATNU ILI PRVU PRETPLATU) ---
        if (eventName === 'order_created') {
            const orderData = payload.data.attributes;

            if (orderData.status !== 'paid') {
                await connection.release(); // Vraćamo konekciju jer nećemo raditi sa bazom
                return res.status(200).send('Porudžbina primljena, ali nije plaćena.');
            }

            const variantId = orderData.first_order_item?.variant_id;
            if (!variantId) throw new Error('Variant ID nedostaje u webhook payload-u.');
            
            // Proveravamo da li je kupljeni kurs pretplata
            const [kursevi] = await connection.query('SELECT id, is_subscription FROM kursevi WHERE lemon_squeezy_variant_id = ?', [variantId]);
            if (kursevi.length === 0) throw new Error(`Nijedan kurs nije pronađen za variant_id: ${variantId}`);
            
            const kursData = kursevi[0];
            const kursId = kursData.id;
            const isSubscription = kursData.is_subscription === 1; // Proveravamo da li je 1 (true)

            const userEmail = orderData.user_email.toLowerCase();
            const userName = orderData.user_name;

            let expiryDate = null; // Podrazumevana vrednost
            if (isSubscription) {
                // Ako jeste pretplata, odmah postavljamo datum isteka
                expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 31); // Traje 31 dan
                console.log(`Kurs je pretplata. Datum isteka postavljen na: ${expiryDate.toISOString()}`);
            }

            const [existingUsers] = await connection.query('SELECT id FROM korisnici WHERE email = ?', [userEmail]);
            let userId;

            if (existingUsers.length > 0) {
                userId = existingUsers[0].id;
                // Ako korisnik već postoji a kupio je pretplatu, ažuriramo mu datum isteka
                if (isSubscription) {
                    await connection.query('UPDATE korisnici SET subscription_expires_at = ? WHERE id = ?', [expiryDate, userId]);
                }
            } else {
                // Kreiramo novog korisnika
                const password = generateRandomPassword();
                const hashedPassword = await bcrypt.hash(password, 10);
                const [ime, ...prezimeParts] = userName.split(' ');
                const prezime = prezimeParts.join(' ') || ime;

                console.log(`Korisnik je kupio, mejl mu je: ${userEmail}, generisana šifra mu je: ${password}`);

                // Upisujemo korisnika sa (eventualnim) datumom isteka
                const [newUserResult] = await connection.query(
                    'INSERT INTO korisnici (ime, prezime, email, sifra, uloga, subscription_expires_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [ime, prezime, userEmail, hashedPassword, 'korisnik', expiryDate]
                );
                userId = newUserResult.insertId;

                const pismo = `
  <div style="background-color:#121212;padding:40px 0;text-align:center;font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width:500px;margin:0 auto;background-color:#1e1e1e;padding:30px;border-radius:12px;box-shadow:0 0 20px rgba(255, 60, 0, 0.5);">
    <h1 style="color:#ff3c00;margin-bottom:20px;">Dobrodošao, ${ime}!</h1>
    <p style="color:#ffffff;font-size:16px;margin-bottom:30px;">
      Hvala ti što si kupio kurs. Tvoj nalog je uspešno kreiran i spreman za korišćenje.
    </p>
    <div style="text-align:left;background:#121212;padding:20px;border-radius:8px;border:1px solid #ff3c00;color:#fff;">
      <p style="margin:0 0 10px;"><strong>Email:</strong> ${userEmail}</p>
      <p style="margin:0;"><strong>Lozinka:</strong> <span style="color:#ff3c00;">${password}</span></p>
    </div>
    <div style="text-align:left;background:#121212;padding:20px;border-radius:8px;border:1px solid #ff3c00;color:#fff;">
      <p style="margin:0 0 10px;"><strong>Link:</strong> https://learningplatform1.netlify.app/login</p>
      <p style="margin:0;"><strong>Discord:</strong> <span style="color:#ff3c00;">https://discord.gg/filipmotion</span></p>
    </div>
    <p style="color:#888;margin-top:30px;font-size:12px;">
      Savet: Nakon prijave, možeš odmah da promeniš svoju lozinku u podešavanjima profila.
    </p>
  </div>
</div>
`;
                
                // Šaljemo email samo novom korisniku
                try {
                    const resend = new Resend(process.env.RESEND_API_KEY);
                    await resend.emails.send({
                        from: 'MotionAcademy <office@undovrbas.com>',
                        to: userEmail,
                        subject: 'Dobrodošli! Vaš nalog je kreiran.',
                        html: pismo
                    });
                } catch (emailError) {
                    console.error("Greška prilikom slanja email-a:", emailError);
                }
            }

            // Upis u 'kupovina' i 'transakcije' ostaje isti
            const [postojecaKupovina] = await connection.query('SELECT id FROM kupovina WHERE korisnik_id = ? AND kurs_id = ?', [userId, kursId]);
            if (postojecaKupovina.length === 0) {
                await connection.query('INSERT INTO kupovina (korisnik_id, kurs_id) VALUES (?, ?)', [userId, kursId]);
            }
            
            await connection.query(
                'INSERT INTO transakcije (lemon_squeezy_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [payload.data.id, userId, kursId, orderData.total / 100, orderData.currency, orderData.status, JSON.stringify(payload)]
            );

        // --- LOGIKA ZA OBNOVU POSTOJEĆE PRETPLATE ---
        } else if (eventName === 'subscription_payment_success') {
            const subscriptionData = payload.data.attributes;
            const userEmail = subscriptionData.user_email.toLowerCase();
            const [users] = await connection.query('SELECT id FROM korisnici WHERE email = ?', [userEmail]);

            if (users.length > 0) {
                const userId = users[0].id;
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 31);
                await connection.query('UPDATE korisnici SET subscription_expires_at = ? WHERE id = ?', [expiryDate, userId]);
                console.log(`Pretplata za korisnika ID ${userId} je obnovljena do ${expiryDate.toISOString()}.`);
            }
        }

        await connection.commit();
        res.status(200).send('Webhook uspešno obrađen.');

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Greška pri obradi događaja '${eventName}':`, error);
        return res.status(500).send('Greška na serveru prilikom obrade webhooka.');
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
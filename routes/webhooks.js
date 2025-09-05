// backend/routes/webhooks.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const generateRandomPassword = require('../utils/passwordGenerator');
const { Resend } = require('resend');
const { Paddle, EventName, Environment } = require('@paddle/paddle-node-sdk');
const crypto = require('crypto');

// --- Helper funkcije ---

const PLAN_MAP = {
    'pri_01k2mcmvyc542sjay9hz1gvz9s': { name: 'monthly', months: 1 },
    'pri_01k2mcnd83jsvxf34xx3k59jtv': { name: 'quarterly', months: 3 },
    // Dodajte ovde price_id-jeve iz vašeg test webhook-a ako su različiti
    'pri_01gsz8x8sawmvhz1pv30nge1ke': { name: 'monthly', months: 1 }, // Iz test podataka
    'pri_01h1vjfevh5etwq3rb416a23h2': { name: 'addon', months: 1 }, // Addon iz test podataka
};

const paddle = new Paddle(process.env.PADDLE_API_KEY || '', {
    environment: process.env.PADDLE_ENV === 'production' ? Environment.production : Environment.sandbox,
});

async function sendWelcomeEmail(toEmail, plainPassword, firstName = 'Korisnik') {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY nije postavljen - preskačem slanje mejla.');
        return false;
    }
    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = `
          <div style="background-color:#121212;padding:40px 0;text-align:center;font-family:'Segoe UI', Roboto, Arial, sans-serif;">
            <div style="max-width:600px;margin:0 auto;background:#1e1e1e;padding:30px;border-radius:12px;color:#fff;">
              <h1 style="color:#ff3c00">Dobrodošao, ${firstName}!</h1>
              <p>Tvoj nalog je kreiran. Evo podataka za prijavu:</p>
              <p><strong>Email:</strong> ${toEmail}</p>
              <p><strong>Lozinka:</strong> <span style="color:#ff3c00">${plainPassword}</span></p>
              <p>Link za prijavu: https://motionakademija.com/login</p>
              <p>Privatna Discord zajednica: https://discord.gg/filipmotion</p>
            </div>
          </div>
        `;
        await resend.emails.send({
            from: 'MotionAcademy <office@undovrbas.com>',
            to: toEmail,
            subject: 'Dobrodošli u Motion Akademiju! Vaš nalog je kreiran.',
            html
        });
        return true;
    } catch (err) {
        console.error('Greška pri slanju email-a (Resend):', err.message);
        return false;
    }
}

// Funkcija za dobijanje customer podataka preko Paddle API-ja
async function getCustomerById(customerId) {
    try {
        const customer = await paddle.customers.get(customerId);
        return customer;
    } catch (error) {
        console.error('Greška pri dobijanju customer podataka:', error);
        return null;
    }
}

// Funkcija za dobijanje transaction podataka preko Paddle API-ja
async function getTransactionById(transactionId) {
    try {
        const transaction = await paddle.transactions.get(transactionId);
        return transaction;
    } catch (error) {
        console.error('Greška pri dobijanju transaction podataka:', error);
        return null;
    }
}

// --- Funkcija za verifikaciju potpisa (na osnovu Paddle dokumentacije) ---
function verifyWebhookSignature(rawBody, signature, secret) {
    try {
        // 1. Parse signature header
        const sigElements = signature.split(';');
        let timestamp = null;
        let signatures = [];
        
        for (const element of sigElements) {
            const [key, value] = element.split('=');
            if (key === 'ts') {
                timestamp = value;
            } else if (key.startsWith('h1')) {
                signatures.push(value);
            }
        }

        if (!timestamp || signatures.length === 0) {
            console.error('❌ Nema timestamp ili potpis u header-u');
            return false;
        }

        // 2. Build signed payload: timestamp:body (VAŽNO: dvotačka, ne tačka!)
        const signedPayload = `${timestamp}:${rawBody.toString('utf8')}`;
        
        console.log('DEBUG - Timestamp:', timestamp);
        console.log('DEBUG - Body length:', rawBody.length);
        console.log('DEBUG - Signed payload preview:', signedPayload.substring(0, 100) + '...');
        
        // 3. Generate expected signature
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(signedPayload, 'utf8');
        const expectedSignature = hmac.digest('hex');
        
        console.log('DEBUG - Expected signature:', expectedSignature);
        console.log('DEBUG - Received signatures:', signatures);
        
        // 4. Compare signatures (timing-safe comparison)
        for (const sig of signatures) {
            try {
                const expectedBuffer = Buffer.from(expectedSignature, 'hex');
                const receivedBuffer = Buffer.from(sig, 'hex');
                
                if (expectedBuffer.length === receivedBuffer.length && 
                    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
                    console.log('✅ Potpis je validan!');
                    return true;
                }
            } catch (compareError) {
                console.error('Greška pri poređenju potpisa:', compareError);
            }
        }
        
        console.error('❌ Nijedan potpis se ne poklapa!');
        return false;
        
    } catch (error) {
        console.error('❌ Greška pri verifikaciji potpisa:', error);
        return false;
    }
}

// --- Funkcija za obradu subscription.created događaja ---
async function handleSubscriptionCreated(subscriptionData, connection) {
    try {
        console.log('=== OBRADA SUBSCRIPTION.CREATED ===');

        // Pokušamo dohvatiti customer podatke preko Paddle API-ja (ako je moguće)
        const customer = await getCustomerById(subscriptionData.customer_id);
        const customerEmail = customer?.email?.toLowerCase();
        const customerName = customer?.name || 'Korisnik';
        const kursId = 1;

        if (!customerEmail) {
            console.warn('subscription.created: nema email-a u customer podacima, preskačem.');
            return;
        }

        // Izračunavanje datuma isteka
        let expiryDate = subscriptionData.next_billed_at ? new Date(subscriptionData.next_billed_at) : new Date();
        if (!subscriptionData.next_billed_at) {
            const priceId = subscriptionData.items?.[0]?.price?.id;
            if (priceId && PLAN_MAP[priceId]) expiryDate.setMonth(expiryDate.getMonth() + PLAN_MAP[priceId].months);
            else expiryDate.setMonth(expiryDate.getMonth() + 1);
        }

        // 1) Pokušaj pronaći korisnika po paddle_customer_id ili email
        const [rows] = await connection.query(
            'SELECT id, paddle_customer_id FROM korisnici WHERE paddle_customer_id = ? OR email = ? LIMIT 1',
            [subscriptionData.customer_id, customerEmail]
        );

        let userId;
        let createdNew = false;

        if (rows.length > 0) {
            // Postoji korisnik -> update
            userId = rows[0].id;
            await connection.query(
                'UPDATE korisnici SET subscription_expires_at = ?, paddle_customer_id = COALESCE(paddle_customer_id, ?) , subscription_status = ? WHERE id = ?',
                [expiryDate, subscriptionData.customer_id, 'active', userId]
            );
            console.log(`Ažuriran postojeći korisnik (ID=${userId}), novi expiry=${expiryDate.toISOString()}`);
        } else {
            // Ne postoji -> pokušaj da kreiramo nov nalog (ali pazimo na race condition)
            const password = generateRandomPassword();
            const hashedPassword = await bcrypt.hash(password, 10);
            const [ime, ...prezimeParts] = customerName.split(/\s+/);
            const prezime = prezimeParts.join(' ') || ime;

            try {
                const [insertRes] = await connection.query(
                    `INSERT INTO korisnici (ime, prezime, email, sifra, uloga, subscription_expires_at, paddle_customer_id, subscription_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ime, prezime, customerEmail, hashedPassword, 'korisnik', expiryDate, subscriptionData.customer_id, 'active']
                );
                userId = insertRes.insertId;
                createdNew = true;
                console.log(`Kreiran novi korisnik ID=${userId}, email=${customerEmail}`);
            } catch (err) {
                if (err && err.code === 'ER_DUP_ENTRY') {
                    // Nekome se u međuvremenu kreirao nalog — dohvatimo ga i update-ujemo
                    console.warn('INSERT bacio ER_DUP_ENTRY, pokušavam SELECT i update umesto kreiranja...');
                    const [existing] = await connection.query(
                        'SELECT id FROM korisnici WHERE email = ? LIMIT 1',
                        [customerEmail]
                    );
                    if (existing.length > 0) {
                        userId = existing[0].id;
                        await connection.query(
                            'UPDATE korisnici SET subscription_expires_at = ?, paddle_customer_id = COALESCE(paddle_customer_id, ?), subscription_status = ? WHERE id = ?',
                            [expiryDate, subscriptionData.customer_id, 'active', userId]
                        );
                        console.log(`Nakon ER_DUP_ENTRY: ažuriran postojeći korisnik ID=${userId}`);
                    } else {
                        // Neočekivano stanje
                        throw err;
                    }
                } else {
                    throw err;
                }
            }

            // Ako smo kreirali nov korisnik, pošalji welcome e-mail
            if (createdNew) {
                try {
                    await sendWelcomeEmail(customerEmail, password, ime);
                } catch (mailErr) {
                    console.warn('Neuspeo slanje welcome email-a:', mailErr);
                }
            }
        }

        // Dodela/obnova pristupa kursu (INSERT/ON DUPLICATE)
        await connection.query(
            'INSERT INTO kupovina (korisnik_id, kurs_id, datum_kupovine) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE datum_kupovine = NOW()',
            [userId, kursId]
        );

        // Upis u transakcije ako imamo transaction_id
        if (subscriptionData.transaction_id) {
            const transaction = await getTransactionById(subscriptionData.transaction_id);
            const amount = transaction ? (transaction.details?.totals?.total / 100) : 0;
            const currency = subscriptionData.currency_code || null;
            await connection.query(
                'INSERT INTO transakcije (provider_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    subscriptionData.id,
                    userId,
                    kursId,
                    amount,
                    currency,
                    subscriptionData.status,
                    JSON.stringify(subscriptionData)
                ]
            );
        }

        console.log('=== SUBSCRIPTION.CREATED PROCESIRAN ===');
    } catch (error) {
        console.error('Greška u handleSubscriptionCreated:', error);
        throw error;
    }
}


// --- Funkcija za obradu subscription.renewed događaja ---
async function handleSubscriptionRenewed(subscriptionData, connection) {
    try {
        console.log('=== OBRADA SUBSCRIPTION.RENEWED ===');
        
        const customerId = subscriptionData.customer_id;
        let expiryDate = new Date();
        
        if (subscriptionData.next_billed_at) {
            expiryDate = new Date(subscriptionData.next_billed_at);
        } else {
            // Fallback na osnovu price_id
            const priceId = subscriptionData.items?.[0]?.price?.id;
            if (priceId && PLAN_MAP[priceId]) {
                expiryDate.setMonth(expiryDate.getMonth() + PLAN_MAP[priceId].months);
            } else {
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            }
        }

        // Ažuriraj datum isteka za korisnika
        const [result] = await connection.query(
            'UPDATE korisnici SET subscription_expires_at = ?, subscription_status = ? WHERE paddle_customer_id = ?',
            [expiryDate, 'active', customerId]
        );

        if (result.affectedRows > 0) {
            console.log(`Pretplata produžena za customer_id: ${customerId}, novi datum isteka: ${expiryDate.toISOString()}`);
            
            // Dodaj novi zapis u transakcije za renewal
            if (subscriptionData.transaction_id) {
                const transaction = await getTransactionById(subscriptionData.transaction_id);
                const [user] = await connection.query('SELECT id FROM korisnici WHERE paddle_customer_id = ?', [customerId]);
                
                if (user.length > 0 && transaction) {
                    await connection.query(
                        'INSERT INTO transakcije (provider_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca, tip_transakcije) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            subscriptionData.id,
                            user[0].id,
                            1, // kurs_id
                            (transaction.details.totals.total / 100),
                            subscriptionData.currency_code,
                            'completed',
                            JSON.stringify(subscriptionData),
                            'renewal'
                        ]
                    );
                    console.log(`Evidentiran renewal za subscription ${subscriptionData.id}`);
                }
            }
        } else {
            console.warn(`Ne mogu da pronađem korisnika sa paddle_customer_id: ${customerId}`);
        }
        
    } catch (error) {
        console.error('Greška u handleSubscriptionRenewed:', error);
        throw error;
    }
}

// --- Funkcija za obradu transaction.completed događaja ---
async function handleTransactionCompleted(transaction, connection) {
    try {
        if (!transaction || !transaction.customer || !transaction.customer.email) {
            console.warn('handleTransactionCompleted: Transakcija nema email kupca, preskače se.');
            return;
        }

        const customerEmail = transaction.customer.email.toLowerCase();
        const customerName = transaction.customer.name || 'Korisnik';
        const customerId = transaction.customer_id;
        const kursId = 1;

        // Izračunavanje datuma isteka
        let expiryDate = new Date();
        const priceId = transaction.items?.[0]?.price_id;
        if (priceId && PLAN_MAP[priceId]) {
            expiryDate.setMonth(expiryDate.getMonth() + PLAN_MAP[priceId].months);
        } else {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
        }

        // Pokušaj pronaći korisnika po paddle_customer_id ili email
        const [rows] = await connection.query(
            'SELECT id, paddle_customer_id FROM korisnici WHERE paddle_customer_id = ? OR email = ? LIMIT 1',
            [customerId, customerEmail]
        );

        let userId;
        let createdNew = false;
        let plainPassword = null;

        if (rows.length > 0) {
            // Ako postoji -> update
            userId = rows[0].id;
            await connection.query(
                'UPDATE korisnici SET subscription_expires_at = ?, paddle_customer_id = COALESCE(paddle_customer_id, ?) , subscription_status = ? WHERE id = ?',
                [expiryDate, customerId, 'active', userId]
            );
            console.log(`Postojeći korisnik ID=${userId} ažuriran, novo isticanje: ${expiryDate.toISOString()}`);
        } else {
            // Ne postoji -> pokušaj da kreiramo nov nalog (sa rukovanjem ER_DUP_ENTRY)
            plainPassword = generateRandomPassword();
            const hashedPassword = await bcrypt.hash(plainPassword, 10);
            const [ime, ...prezimeParts] = customerName.split(/\s+/);
            const prezime = prezimeParts.join(' ') || ime;

            try {
                const [insertRes] = await connection.query(
                    `INSERT INTO korisnici (ime, prezime, email, sifra, uloga, subscription_expires_at, paddle_customer_id, subscription_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ime, prezime, customerEmail, hashedPassword, 'korisnik', expiryDate, customerId, 'active']
                );
                userId = insertRes.insertId;
                createdNew = true;
                console.log(`Kreiran novi korisnik ID=${userId}, email=${customerEmail}`);
            } catch (err) {
                if (err && err.code === 'ER_DUP_ENTRY') {
                    // Utrka - dohvatimo već postojeći user
                    console.warn('transaction.completed: ER_DUP_ENTRY na insert, pokušavam SELECT...');
                    const [existing] = await connection.query('SELECT id FROM korisnici WHERE email = ? LIMIT 1', [customerEmail]);
                    if (existing.length > 0) {
                        userId = existing[0].id;
                        await connection.query(
                            'UPDATE korisnici SET subscription_expires_at = ?, paddle_customer_id = COALESCE(paddle_customer_id, ?), subscription_status = ? WHERE id = ?',
                            [expiryDate, customerId, 'active', userId]
                        );
                        console.log(`Nakon ER_DUP_ENTRY: ažuriran korisnik ID=${userId}`);
                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }

            if (createdNew) {
                try {
                    await sendWelcomeEmail(customerEmail, plainPassword, ime);
                } catch (mailErr) {
                    console.warn('Neuspeo slanje welcome email-a:', mailErr);
                }
            }
        }

        // Dodela pristupa kursu
        await connection.query(
            'INSERT INTO kupovina (korisnik_id, kurs_id, datum_kupovine) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE datum_kupovine = NOW()',
            [userId, kursId]
        );

        // Upis u transakcije
        const amount = transaction.details?.totals?.total ? (transaction.details.totals.total / 100) : 0;
        await connection.query(
            'INSERT INTO transakcije (provider_order_id, korisnik_id, kurs_id, iznos, valuta, status_placanja, podaci_kupca) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                transaction.id,
                userId,
                kursId,
                amount,
                transaction.currency_code || null,
                transaction.status || null,
                JSON.stringify(transaction)
            ]
        );

        console.log(`transaction.completed: Evidentirana transakcija ${transaction.id} za korisnika ID ${userId}.`);
    } catch (error) {
        console.error('Greška u handleTransactionCompleted:', error);
        throw error;
    }
}



// --- DODAJTE OVE FUNKCIJE ---
async function handlePaymentSucceeded(subscriptionData, connection) {
    try {
        console.log('=== OBRADA SUBSCRIPTION.PAYMENT_SUCCEEDED ===');
        
        // Osiguraj da korisnik ima aktivan pristup
        const [result] = await connection.query(
            'UPDATE korisnici SET subscription_status = ? WHERE paddle_customer_id = ?',
            ['active', subscriptionData.customer_id]
        );
        
        if (result.affectedRows > 0) {
            console.log(`Potvrđen uspešan payment za customer_id: ${subscriptionData.customer_id}`);
        } else {
            console.warn(`Korisnik sa paddle_customer_id ${subscriptionData.customer_id} nije pronađen`);
        }
        
    } catch (error) {
        console.error('Greška u handlePaymentSucceeded:', error);
        throw error;
    }
}

async function handlePaymentFailed(subscriptionData, connection) {
    try {
        console.log('=== OBRADA SUBSCRIPTION.PAYMENT_FAILED ===');
        
        // Označi kao neaktivan, ali ne uklanjaj pristup odmah
        // (Paddle će poslati još nekoliko pokušaja)
        const [result] = await connection.query(
            'UPDATE korisnici SET subscription_status = ? WHERE paddle_customer_id = ?',
            ['payment_failed', subscriptionData.customer_id]
        );
        
        if (result.affectedRows > 0) {
            console.log(`Payment failed za customer_id: ${subscriptionData.customer_id}`);
        }
        
        // TODO: Opciono - pošaljite email korisniku o neuspešnoj naplati
        
    } catch (error) {
        console.error('Greška u handlePaymentFailed:', error);
        throw error;
    }
}

async function handleSubscriptionCancelled(subscriptionData, connection) {
    try {
        console.log('=== OBRADA SUBSCRIPTION.CANCELLED ===');
        
        // Postaviti status na cancelled, ali zadržati pristup do kraja billing ciklusa
        const [result] = await connection.query(
            'UPDATE korisnici SET subscription_status = ? WHERE paddle_customer_id = ?',
            ['cancelled', subscriptionData.customer_id]
        );
        
        if (result.affectedRows > 0) {
            console.log(`Subscription cancelled za customer_id: ${subscriptionData.customer_id}`);
            // Korisnik zadržava pristup do subscription_expires_at datuma
        }
        
    } catch (error) {
        console.error('Greška u handleSubscriptionCancelled:', error);
        throw error;
    }
}

async function handleSubscriptionExpired(subscriptionData, connection) {
    try {
        console.log('=== OBRADA SUBSCRIPTION.EXPIRED ===');
        
        // Pronađi korisnika i ukloni mu pristup
        const [users] = await connection.query(
            'SELECT id FROM korisnici WHERE paddle_customer_id = ?',
            [subscriptionData.customer_id]
        );
        
        if (users.length > 0) {
            const userId = users[0].id;
            
            // Ukloni pristup kursu
            await connection.query(
                'DELETE FROM kupovina WHERE korisnik_id = ?',
                [userId]
            );
            
            // Ažuriraj status korisnika
            await connection.query(
                'UPDATE korisnici SET subscription_status = ?, subscription_expires_at = NULL WHERE id = ?',
                ['expired', userId]
            );
            
            console.log(`Pristup uklonjen za expired subscription, user_id: ${userId}`);
        } else {
            console.warn(`Korisnik sa paddle_customer_id ${subscriptionData.customer_id} nije pronađen`);
        }
        
    } catch (error) {
        console.error('Greška u handleSubscriptionExpired:', error);
        throw error;
    }
}

// --- Glavni Webhook Ruter ---
router.post('/paddle', async (req, res) => {
    console.log('=== WEBHOOK PRIMLJEN ===');
    const signatureHeader = req.get('Paddle-Signature') || '';
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    
    // req.body je raw Buffer zbog express.raw() middleware-a
    const rawBody = req.body;

    console.log('Signature header:', signatureHeader);
    console.log('Raw body type:', typeof rawBody);
    console.log('Raw body length:', rawBody ? rawBody.length : 'undefined');
    console.log('Raw body je Buffer?', Buffer.isBuffer(rawBody));

    if (!rawBody || !webhookSecret || !signatureHeader) {
        console.error('Nedostaju podaci za verifikaciju');
        return res.status(400).send('Verification data missing.');
    }

    // Verifikacija potpisa koristeći Paddle dokumentaciju
    if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
        console.error('❌ Verifikacija potpisa neuspešna!');
        return res.status(400).send('Signature verification failed.');
    }

    try {
        // Parsiranje event-a
        const event = JSON.parse(rawBody.toString('utf8'));
        const eventType = event.event_type;
        
        console.log(`Event tip: ${eventType}`);
        console.log('Event podaci (kratak):', JSON.stringify(event.data, null, 2).substring(0, 500));

        // Odmah odgovori Paddle-u
        res.status(200).send('Webhook successfully verified and processed.');
        
        // Obrada u pozadini
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            console.log(`=== OBRADA DOGAĐAJA: ${eventType} ===`);
            
            switch (eventType) {
                case 'subscription.created':
                case 'subscription.activated':
                    await handleSubscriptionCreated(event.data, connection);
                    break;
                
                case 'subscription.updated':
                case 'subscription.renewed':
                    await handleSubscriptionRenewed(event.data, connection);
                    break;
                
                case 'subscription.payment_succeeded':
                    await handlePaymentSucceeded(event.data, connection);
                    break;
                
                case 'subscription.payment_failed':
                    await handlePaymentFailed(event.data, connection);
                    break;
                
                case 'subscription.cancelled':
                    await handleSubscriptionCancelled(event.data, connection);
                    break;
                
                case 'subscription.expired':
                    await handleSubscriptionExpired(event.data, connection);
                    break;
                
                case 'transaction.completed':
                    await handleTransactionCompleted(event.data, connection);
                    break;
                
                default:
                    console.log(`Događaj '${eventType}' primljen, ali se ignoriše.`);
            }
            
            await connection.commit();
            console.log('=== OBRADA USPEŠNO ZAVRŠENA ===');
            
        } catch (err) {
            await connection.rollback();
            console.error('Greška pri obradi događaja u bazi:', err);
        } finally {
            if (connection) connection.release();
        }
        
    } catch (error) {
        console.error('🔴 Greška pri webhook obradi:', error.message);
        return res.status(400).send('Webhook processing failed.');
    }
});

module.exports = router;
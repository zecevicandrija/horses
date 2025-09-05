// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware za admin autentifikaciju (dodajte prema vašoj logici)
const requireAdmin = (req, res, next) => {
    // TODO: Implementirajte admin proverу
    // Možete koristiti JWT token ili jednostavan API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Cron job za čišćenje isteklih pretplata
router.post('/cleanup-expired-subscriptions', requireAdmin, async (req, res) => {
    try {
        console.log('=== POKRETANJE CLEANUP EXPIRED SUBSCRIPTIONS ===');
        
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            // Pronađi sve korisnike čije su pretplate istekle
            const [expiredUsers] = await connection.query(`
                SELECT id, email, subscription_expires_at 
                FROM korisnici 
                WHERE subscription_expires_at < NOW() 
                AND subscription_status IN ('active', 'payment_failed')
            `);
            
            console.log(`Pronađeno ${expiredUsers.length} isteklih pretplata`);
            
            for (const user of expiredUsers) {
                // Ukloni pristup kursu
                await connection.query(
                    'DELETE FROM kupovina WHERE korisnik_id = ?',
                    [user.id]
                );
                
                // Ažuriraj status
                await connection.query(
                    'UPDATE korisnici SET subscription_status = ? WHERE id = ?',
                    ['expired', user.id]
                );
                
                console.log(`Uklonjen pristup za korisnika: ${user.email}`);
            }
            
            await connection.commit();
            
            res.json({ 
                success: true, 
                message: `Processed ${expiredUsers.length} expired subscriptions`,
                expiredCount: expiredUsers.length
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Greška u cleanup:', error);
        res.status(500).json({ error: 'Cleanup failed', details: error.message });
    }
});

// Dodatni endpoint za pregled subscription statistika
router.get('/subscription-stats', requireAdmin, async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                subscription_status,
                COUNT(*) as count,
                COUNT(CASE WHEN subscription_expires_at > NOW() THEN 1 END) as active_count,
                COUNT(CASE WHEN subscription_expires_at <= NOW() THEN 1 END) as expired_count
            FROM korisnici 
            WHERE subscription_expires_at IS NOT NULL
            GROUP BY subscription_status
        `);
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Greška pri dohvatanju statistika:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
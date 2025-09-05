const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint to fetch purchased courses for a user
router.get('/user/:korisnikId', async (req, res) => {
    try {
        const korisnikId = req.params.korisnikId;
        // Ažuriran upit da dohvati i 'is_subscription' informaciju
        const query = `
            SELECT k.*, p.datum_kupovine, k.is_subscription, p.price_id 
            FROM kursevi k
            INNER JOIN kupovina p ON k.id = p.kurs_id
            WHERE p.korisnik_id = ?
            AND p.datum_kupovine = (
                SELECT MAX(datum_kupovine) 
                FROM kupovina 
                WHERE korisnik_id = p.korisnik_id AND kurs_id = p.kurs_id
  )
        `;
        const [results] = await db.query(query, [korisnikId]);
        res.status(200).json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint za dodavanje kupovine
router.post('/', async (req, res) => {
    try {
        const { korisnik_id, kurs_id, popust_id } = req.body;
        const query = 'INSERT INTO kupovina (korisnik_id, kurs_id, popust_id) VALUES (?, ?, ?)';
        const [result] = await db.query(query, [korisnik_id, kurs_id, popust_id]);
        res.status(201).json({ success: true, message: 'Purchase recorded successfully', id: result.insertId });
    } catch (error) {
        console.error('Error recording purchase:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to get the number of purchases for each course
router.get('/popularity', async (req, res) => {
    try {
        const query = `
            SELECT 
                k.id AS kurs_id, 
                k.naziv AS kurs_naziv, 
                k.cena AS kurs_cena, 
                COUNT(p.kurs_id) AS broj_kupovina
            FROM kursevi k
            LEFT JOIN kupovina p ON k.id = p.kurs_id
            GROUP BY k.id, k.naziv, k.cena
        `;
        const [results] = await db.query(query);
        res.status(200).json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get students who purchased a specific course
router.get('/studenti/:kursId', async (req, res) => {
    try {
        const kursId = req.params.kursId;
        const query = `
            SELECT k.id AS student_id, k.ime, k.prezime, k.email, p.datum_kupovine
            FROM korisnici k
            INNER JOIN kupovina p ON k.id = p.korisnik_id
            WHERE p.kurs_id = ?
        `;
        const [results] = await db.query(query, [kursId]);
        res.status(200).json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get revenue grouped by date
router.get('/zarada-po-danu', async (req, res) => {
    try {
        const query = `
            SELECT 
                DATE(p.datum_kupovine) AS dan, 
                SUM(k.cena * (1 - IFNULL(pop.procenat / 100, 0))) AS dnevna_zarada
            FROM kupovina p
            INNER JOIN kursevi k ON p.kurs_id = k.id
            LEFT JOIN popusti pop ON p.popust_id = pop.id
            GROUP BY DATE(p.datum_kupovine)
            ORDER BY dan ASC
        `;
        const [results] = await db.query(query);
        res.status(200).json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;

// U fajlu: backend/routes/kupovina.js

// NOVA RUTA ZA STATISTIKU KURSA
router.get('/statistika/:kursId', async (req, res) => {
    try {
        const { kursId } = req.params;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Početni i krajnji datum su obavezni.' });
        }

        // Osnovni upit za filtriranje po kursu i datumu
        let params = [kursId, startDate, `${endDate} 23:59:59`];
        let query = `
            SELECT 
                p.datum_kupovine,
                k.cena * (1 - IFNULL(pop.procenat / 100, 0)) AS cena_sa_popustom
            FROM kupovina p
            JOIN kursevi k ON p.kurs_id = k.id
            LEFT JOIN popusti pop ON p.popust_id = pop.id
            WHERE p.kurs_id = ? AND p.datum_kupovine BETWEEN ? AND ?
        `;

        const [kupovine] = await db.query(query, params);

        // Izračunavanje ukupnih vrednosti
        const totalSales = kupovine.length;
        const totalRevenue = kupovine.reduce((sum, kupovina) => sum + Number(kupovina.cena_sa_popustom), 0);
        
        // Priprema podataka za chart
        const salesByDate = {};
        kupovine.forEach(k => {
            const date = new Date(k.datum_kupovine).toISOString().split('T')[0]; // Format YYYY-MM-DD
            if (!salesByDate[date]) {
                salesByDate[date] = { sales: 0, revenue: 0 };
            }
            salesByDate[date].sales += 1;
            salesByDate[date].revenue += Number(k.cena_sa_popustom);
        });

        const chartData = Object.keys(salesByDate).map(date => ({
            date,
            sales: salesByDate[date].sales,
            revenue: salesByDate[date].revenue,
        })).sort((a, b) => new Date(a.date) - new Date(b.date));


        res.status(200).json({
            totalSales,
            totalRevenue,
            chartData
        });

    } catch (error) {
        console.error('Greška pri dohvatanju statistike:', error);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
});
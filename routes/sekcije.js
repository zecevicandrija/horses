// backend/routes/sekcije.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// --- PUT /api/sekcije/order - Ažuriranje redosleda sekcija ---
// Ova ruta ostaje nepromenjena
router.put('/order', async (req, res) => {
    try {
        const { orderedIds } = req.body; // Očekujemo niz ID-jeva: [3, 1, 2]

        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            return res.status(400).json({ error: 'Niz ID-jeva je neophodan.' });
        }

        const promises = orderedIds.map((id, index) => {
            const query = 'UPDATE sekcije SET redosled = ? WHERE id = ?';
            // redosled kreće od 1, a index od 0
            return db.query(query, [index + 1, id]);
        });

        await Promise.all(promises);

        res.status(200).json({ message: 'Redosled sekcija je uspešno sačuvan.' });
    } catch (error) {
        console.error('Greška pri ažuriranju redosleda:', error);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
});

// --- PUT /api/sekcije/:id - Izmena naziva i THUMBNAIL-a sekcije ---
// IZMENJENO: Dodata je logika za ažuriranje thumbnail-a
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { naziv, thumbnail } = req.body; // Dohvatamo i thumbnail

        if (!naziv) {
            return res.status(400).json({ error: 'Naziv sekcije je obavezan.' });
        }

        // Ažuriramo i naziv i thumbnail. Ako je thumbnail prazan string, sačuvaće se kao NULL.
        const query = 'UPDATE sekcije SET naziv = ?, thumbnail = ? WHERE id = ?';
        const [result] = await db.query(query, [naziv, thumbnail || null, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Sekcija nije pronađena.' });
        }

        res.status(200).json({ message: 'Sekcija je uspešno ažurirana.' });
    } catch (error) {
        console.error('Greška pri ažuriranju sekcije:', error);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
});



// --- DELETE /api/sekcije/:id - Brisanje sekcije ---
// Ova ruta ostaje nepromenjena
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'DELETE FROM sekcije WHERE id = ?';
        const [result] = await db.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Sekcija nije pronađena.' });
        }

        res.status(200).json({ message: 'Sekcija uspešno obrisana.' });
    } catch (error) {
        console.error('Greška pri brisanju sekcije:', error);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
});



// --- POST /api/sekcije - Kreiranje nove sekcije za kurs sa THUMBNAIL-om ---
// IZMENJENO: Dodata je logika za dodavanje thumbnail-a
router.post('/', async (req, res) => {
    try {
        const { kurs_id, naziv, thumbnail } = req.body; // Dohvatamo i thumbnail

        if (!kurs_id || !naziv) {
            return res.status(400).json({ error: 'ID kursa i naziv sekcije su obavezni.' });
        }

        // Pronađi najveći trenutni `redosled` za dati kurs da bi novu sekciju dodali na kraj
        const [maxOrderResult] = await db.query(
            'SELECT MAX(redosled) as maxRedosled FROM sekcije WHERE kurs_id = ?',
            [kurs_id]
        );

        const noviRedosled = (maxOrderResult[0].maxRedosled || 0) + 1;

        // Ubaci novu sekciju u bazu, uključujući i thumbnail
        // Ako je thumbnail prazan string, sačuvaće se kao NULL.
        const query = 'INSERT INTO sekcije (kurs_id, naziv, redosled, thumbnail) VALUES (?, ?, ?, ?)';
        const [result] = await db.query(query, [kurs_id, naziv, noviRedosled, thumbnail || null]);

        res.status(201).json({ message: 'Sekcija je uspešno kreirana.', insertId: result.insertId });

    } catch (error) {
        console.error('Greška pri kreiranju sekcije:', error);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
// Uvozimo ispravne funkcije iz našeg Bunny.js helpera
const { createVideo, uploadVideo, getSecurePlayerUrl } = require('../utils/bunny');

// Multer ostaje isti, on samo priprema fajl u memoriji
const upload = multer({ storage: multer.memoryStorage() });


// --- POST Dodavanje lekcije (AŽURIRANA LOGIKA) ---
router.post('/', upload.single('video'), async (req, res) => {
    try {
        // IZMENA: Umesto 'section' sada primamo 'sekcija_id'
        const { course_id, title, content, sekcija_id, assignment } = req.body;

        // IZMENA: Proveravamo 'sekcija_id' umesto 'section' (iako nije obavezno za validaciju)
        if (!course_id || !title || !content || !req.file) {
            return res.status(400).json({ error: 'Sva polja i video su obavezni.' });
        }
        
        const videoObject = await createVideo(title);
        const videoGuid = videoObject.guid;

        await uploadVideo(videoGuid, req.file.buffer);

        // IZMENA: Ažuriran SQL upit da koristi 'sekcija_id'
        const query = 'INSERT INTO lekcije (course_id, title, content, video_url, sekcija_id, assignment) VALUES (?, ?, ?, ?, ?, ?)';
        // IZMENA: Prosleđujemo 'sekcija_id' u upit
        await db.query(query, [course_id, title, content, videoGuid, sekcija_id, assignment || null]);
        
        res.status(201).json({ message: 'Lekcija i video su uspešno dodati.' });
    } catch (error) {
        console.error('Greška pri dodavanju lekcije:', error);
        res.status(500).json({ error: 'Došlo je do greške na serveru.' });
    }
});

// --- PUT Ažuriranje lekcije (AŽURIRANA LOGIKA) ---
router.put('/:id', upload.single('video'), async (req, res) => {
    try {
        const lessonId = req.params.id;
        // IZMENA: Umesto 'section' sada primamo 'sekcija_id'
        const { course_id, title, content, sekcija_id, video_url, assignment } = req.body;
        if (!course_id || !title || !content) {
            return res.status(400).json({ error: 'Nedostaju obavezna polja.' });
        }

        let newVideoUrl = video_url || '';
        if (req.file) {
            const videoObject = await createVideo(title);
            const videoGuid = videoObject.guid;
            await uploadVideo(videoGuid, req.file.buffer);
            newVideoUrl = videoGuid;
        }

        // IZMENA: Ažuriran SQL upit da koristi 'sekcija_id'
        const query = 'UPDATE lekcije SET course_id = ?, title = ?, content = ?, video_url = ?, sekcija_id = ?, assignment = ? WHERE id = ?';
        // IZMENA: Prosleđujemo 'sekcija_id' u upit
        await db.query(query, [course_id, title, content, newVideoUrl, sekcija_id, assignment, lessonId]);
        
        res.status(200).json({ message: `Lekcija sa ID-jem ${lessonId} uspešno ažurirana.` });
    } catch (error) {
        console.error('Greška pri ažuriranju lekcije:', error);
        res.status(500).json({ error: 'Došlo je do greške na serveru.' });
    }
});

// --- RUTA: Dobijanje sigurnog linka za video (NEMA IZMENA) ---
router.get('/:id/stream', async (req, res) => {
    try {
        const { id } = req.params;
        const [lekcije] = await db.query('SELECT video_url FROM lekcije WHERE id = ?', [id]);

        if (lekcije.length === 0 || !lekcije[0].video_url) {
            return res.status(404).json({ error: 'Video nije pronađen.' });
        }

        const videoId = lekcije[0].video_url;
        const secureUrl = getSecurePlayerUrl(videoId); // Koristimo NOVU, sigurnu funkciju

        res.json({ url: secureUrl });
    } catch (error) {
        console.error('Greška pri generisanju linka:', error);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
});

// GET Sve lekcije (NEMA IZMENA)
router.get('/', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM lekcije');
        res.status(200).json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET Lekcije po kursu (NEMA IZMENA)
router.get('/course/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        const [results] = await db.query('SELECT * FROM lekcije WHERE course_id = ?', [courseId]);
        res.status(200).json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE Brisanje lekcije (NEMA IZMENA)
router.delete('/:id', async (req, res) => {
    try {
        const lessonId = req.params.id;
        const [results] = await db.query('DELETE FROM lekcije WHERE id = ?', [lessonId]);
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: `Lekcija sa ID-jem ${lessonId} nije pronađena.` });
        }
        res.status(200).json({ message: `Lekcija sa ID-jem ${lessonId} uspešno obrisana.` });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// =======================================================================
// IZMENA: CEO ENDPOINT JE AŽURIRAN DA KORISTI NOVU 'sekcije' TABELU
// =======================================================================
// GET Sekcije po kursu
router.get('/sections/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        // Upit sada ide u tabelu `sekcije` i sortira po našoj `redosled` koloni
        const query = 'SELECT id, naziv, redosled FROM sekcije WHERE kurs_id = ? ORDER BY redosled ASC';
        const [results] = await db.query(query, [courseId]);
        // Vraćamo cele objekte (id, naziv, redosled) koji su potrebni za frontend
        res.status(200).json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET Broj lekcija po kursu (NEMA IZMENA)
router.get('/count/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        const [results] = await db.query('SELECT COUNT(*) AS lessonCount FROM lekcije WHERE course_id = ?', [courseId]);
        res.status(200).json({ lessonCount: results[0].lessonCount });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DeepSeek AI ruta (NEMA IZMENA)
router.post('/deepseek-review', async (req, res) => {
    const { code, language } = req.body;
    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.DEEPSEEK_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are a helpful code reviewer. Provide feedback in Serbian.' },
                    { role: 'user', content: `Ovo je moj kod:\n\`\`\`${language}\n${code}\n\`\`\`\nMolim te pogledaj greške i predloži poboljšanja.` }
                ],
            })
        });
        if (!response.ok) throw new Error(`DeepSeek API returned status ${response.status}`);
        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content || 'Greška u AI odgovoru.';
        res.json({ success: true, message: reply });
    } catch (err) {
        console.error('DeepSeek API error:', err);
        res.status(500).json({ success: false, error: 'Greška pri povezivanju sa DeepSeek API-jem' });
    }
});


module.exports = router;
// DodajKorisnika.js

import React, { useState } from 'react';
import api from '../login/api'; // Pretpostavljena putanja iz prethodnih primera
import { Button, TextField, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import './DodajKorisnika.css'; // Import the CSS file

const DodajKorisnika = () => {
    const [ime, setIme] = useState('');
    const [prezime, setPrezime] = useState('');
    const [email, setEmail] = useState('');
    const [sifra, setSifra] = useState('');
    const [uloga, setUloga] = useState('');
    const [telefon, setTelefon] = useState('');
    const [adresa, setAdresa] = useState('');
    const [feedback, setFeedback] = useState({ error: false, message: '' });

    const handleDodajKorisnika = async (e) => {
        e.preventDefault();
        setFeedback({ error: false, message: '' }); // Resetujemo feedback

        if (!ime || !prezime || !email || !sifra || !uloga) {
            setFeedback({ error: true, message: 'Molimo popunite sva obavezna polja.' });
            return;
        }

        try {
            const noviKorisnik = { ime, prezime, email, sifra, uloga, telefon, adresa };
            // 2. Koristimo 'api.post' umesto 'axios.post'
            await api.post('/api/korisnici', noviKorisnik);
            
            setFeedback({ error: false, message: 'Korisnik uspešno dodat!' });

            // Resetujemo polja nakon uspešnog dodavanja
            setIme('');
            setPrezime('');
            setEmail('');
            setSifra('');
            setUloga('');
            setTelefon('');
            setAdresa('');

        } catch (error) {
            console.error('Greška pri dodavanju korisnika:', error);
            // Prikazujemo poruku o grešci korisniku
            const errorMessage = error.response?.data?.message || 'Došlo je do greške na serveru.';
            setFeedback({ error: true, message: `Greška: ${errorMessage}` });
        }
    };

    return (
        <div className="dodaj-korisnika-container">
            <h2 className="dodaj-korisnika-title">Dodaj Korisnika</h2>
            <form className="dodaj-korisnika-form" onSubmit={handleDodajKorisnika}>
                <TextField
                    className="dodaj-korisnika-input"
                    label="Ime"
                    required
                    value={ime}
                    onChange={(e) => setIme(e.target.value)}
                    fullWidth
                    margin="normal"
                />
                <TextField
                    className="dodaj-korisnika-input"
                    label="Prezime"
                    required
                    value={prezime}
                    onChange={(e) => setPrezime(e.target.value)}
                    fullWidth
                    margin="normal"
                />
                <TextField
                    className="dodaj-korisnika-input"
                    type="email"
                    label="Email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    margin="normal"
                />
                <TextField
                    className="dodaj-korisnika-input"
                    type="password"
                    label="Šifra"
                    required
                    value={sifra}
                    onChange={(e) => setSifra(e.target.value)}
                    fullWidth
                    margin="normal"
                />
                <TextField
                    className="dodaj-korisnika-input"
                    label="Telefon"
                    value={telefon}
                    onChange={(e) => setTelefon(e.target.value)}
                    fullWidth
                    margin="normal"
                />
                <TextField
                    className="dodaj-korisnika-input"
                    label="Adresa"
                    value={adresa}
                    onChange={(e) => setAdresa(e.target.value)}
                    fullWidth
                    margin="normal"
                />
                <FormControl fullWidth margin="normal" className="dodaj-korisnika-select-control" required>
                    <InputLabel id="select-uloga-label">Uloga</InputLabel>
                    <Select
                        className="dodaj-korisnika-select"
                        labelId="select-uloga-label"
                        value={uloga}
                        onChange={(e) => setUloga(e.target.value)}
                    >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="instruktor">Instruktor</MenuItem>
                        <MenuItem value="korisnik">Korisnik</MenuItem>
                    </Select>
                </FormControl>

                {feedback.message && (
                    <div style={{ color: feedback.error ? 'red' : 'green', marginTop: '10px' }}>
                        {feedback.message}
                    </div>
                )}

                <Button
                    className="dodaj-korisnika-submit"
                    type="submit"
                    variant="contained"
                    color="primary"
                    style={{ marginTop: '20px' }}
                >
                    Dodaj Korisnika
                </Button>
            </form>
        </div>
    );
};

export default DodajKorisnika;
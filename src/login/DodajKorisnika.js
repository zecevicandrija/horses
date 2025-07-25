import React, { useState } from 'react';
import axios from 'axios';
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

    const handleDodajKorisnika = async (e) => {
        e.preventDefault();
        try {
            const noviKorisnik = { ime, prezime, email, sifra, uloga, telefon, adresa };
            await axios.post('http://localhost:5000/api/korisnici', noviKorisnik);
            setIme('');
            setPrezime('');
            setEmail('');
            setSifra('');
            setUloga('');
            setTelefon('');
            setAdresa('');
        } catch (error) {
            console.error('Greška pri dodavanju korisnika:', error);
        }
    };

    return (
        <div className="dodaj-korisnika-container">
            <h2 className="dodaj-korisnika-title">Dodaj Korisnika</h2>
            <form className="dodaj-korisnika-form" onSubmit={handleDodajKorisnika}>
                <TextField
                    className="dodaj-korisnika-input"
                    label="Ime"
                    value={ime}
                    onChange={(e) => setIme(e.target.value)}
                    fullWidth
                    margin="normal"
                />
                <TextField
                    className="dodaj-korisnika-input"
                    label="Prezime"
                    value={prezime}
                    onChange={(e) => setPrezime(e.target.value)}
                    fullWidth
                    margin="normal"
                />
                <TextField
                    className="dodaj-korisnika-input"
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    margin="normal"
                />
                <TextField
                    className="dodaj-korisnika-input"
                    type="password"
                    label="Šifra"
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
                <FormControl fullWidth margin="normal" className="dodaj-korisnika-select-control">
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
                <Button
                    className="dodaj-korisnika-submit"
                    type="submit"
                    variant="contained"
                    color="primary"
                >
                    Dodaj Korisnika
                </Button>
            </form>
        </div>
    );
};

export default DodajKorisnika;

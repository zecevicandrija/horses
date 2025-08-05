import React, { useState } from 'react';
import { useAuth } from '../login/auth';
import api from '../login/api'; // Koristi centralizovani API klijent
import './DodajKurs.css'; // Uvozimo novi CSS

const DodajKurs = () => {
    const { user } = useAuth();
    const [naziv, setNaziv] = useState('');
    const [opis, setOpis] = useState('');
    const [slika, setSlika] = useState(null);
    const [cena, setCena] = useState('');
    // NOVO: Stanje za dinamičko dodavanje sekcija
    const [sekcije, setSekcije] = useState(['']); // Počinjemo sa jednim praznim poljem

    const handleSekcijaChange = (index, event) => {
        const noviNaziviSekcija = [...sekcije];
        noviNaziviSekcija[index] = event.target.value;

        // Ako korisnik kuca u poslednjem polju, dodaj novo prazno polje
        if (index === sekcije.length - 1 && event.target.value !== '') {
            setSekcije([...noviNaziviSekcija, '']);
        } else {
            setSekcije(noviNaziviSekcija);
        }
    };

    const handleRemoveSekcija = (index) => {
        // Ne dozvoli brisanje poslednjeg polja
        if (sekcije.length <= 1) return;
        const noviNaziviSekcija = [...sekcije];
        noviNaziviSekcija.splice(index, 1);
        setSekcije(noviNaziviSekcija);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            alert('Korisnik nije prijavljen.');
            return;
        }

        const formData = new FormData();
        formData.append('naziv', naziv);
        formData.append('opis', opis);
        formData.append('instruktor_id', user.id);
        formData.append('cena', cena);
        if (slika) {
            formData.append('slika', slika);
        }

        // Dodaj sve neprazne sekcije u formData
        sekcije
            .filter(s => s.trim() !== '') // Ukloni prazna polja
            .forEach(sekcija => {
                formData.append('sekcije[]', sekcija); // `[]` je bitno za backend
            });

        try {
            const response = await api.post('/api/kursevi', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.status === 201) {
                alert('Kurs je uspešno dodat!');
                // Resetuj formu
                setNaziv('');
                setOpis('');
                setCena('');
                setSlika(null);
                setSekcije(['']);
            } else {
                alert('Greška pri dodavanju kursa');
            }
        } catch (error) {
            console.error('Greška:', error);
            alert('Došlo je do greške na serveru.');
        }
    };

    const handleFileChange = (e) => {
        setSlika(e.target.files[0]);
    };

    return (
        <div className="dodaj-kurs-container">
            <form className="dodaj-kurs-form" onSubmit={handleSubmit}>
                <h2 className="form-title">Kreiraj Novi Kurs</h2>
                
                <div className="form-group">
                    <label className="form-label">Naziv Kursa:</label>
                    <input
                        className="form-input"
                        type="text"
                        value={naziv}
                        onChange={(e) => setNaziv(e.target.value)}
                        required
                    />
                </div>
                
                <div className="form-group">
                    <label className="form-label">Opis Kursa:</label>
                    <textarea
                        className="form-textarea"
                        value={opis}
                        onChange={(e) => setOpis(e.target.value)}
                        required
                    />
                </div>
                
                <div className="form-group">
                    <label className="form-label">Cena Kursa (€):</label>
                    <input
                        className="form-input"
                        type="number"
                        step="0.01"
                        value={cena}
                        onChange={(e) => setCena(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Nazivi Sekcija:</label>
                    {sekcije.map((sekcija, index) => (
                        <div key={index} className="sekcija-input-grupa">
                            <input
                                className="form-input"
                                type="text"
                                placeholder={`Sekcija ${index + 1}`}
                                value={sekcija}
                                onChange={(e) => handleSekcijaChange(index, e)}
                            />
                            {/* Pokaži dugme za brisanje samo ako nije poslednje polje */}
                            {sekcije.length > 1 && index < sekcije.length - 1 && (
                                <button 
                                    type="button" 
                                    className="remove-sekcija-btn"
                                    onClick={() => handleRemoveSekcija(index)}
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                
                <div className="form-group">
                    <label className="form-label">Izaberi Naslovnu Sliku:</label>
                    <input
                        className="form-file-input"
                        type="file"
                        onChange={handleFileChange}
                        required
                    />
                </div>
                
                <button className="form-submit-btn" type="submit">Dodaj Kurs</button>
            </form>
        </div>
    );
};

export default DodajKurs;
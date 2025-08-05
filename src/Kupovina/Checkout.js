// frontend/src/pages/Checkout.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
// Dodaj CSS fajl po potrebi
 import './Checkout.css'; 

const Checkout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [ime, setIme] = useState('');
    const [prezime, setPrezime] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (location.state && location.state.items) {
            setItems(location.state.items);
        } else {
            // Ako nema itema, vrati korisnika u korpu
            navigate('/korpa');
        }
    }, [location, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (items.length === 0) {
            setError('Nema kurseva za kupovinu.');
            setIsLoading(false);
            return;
        }

        // Uzimamo prvi kurs iz korpe za obradu
        const kursZaKupovinu = items[0];

        try {
            const response = await axios.post('http://localhost:5000/api/placanje/kreiraj-checkout', {
                kurs_id: kursZaKupovinu.id,
                ime,
                prezime,
                email
            });

            // Preusmeri korisnika na Lemon Squeezy stranicu za plaćanje
            if (response.data.url) {
                window.location.href = response.data.url;
            }

        } catch (err) {
            setError('Došlo je do greške. Molimo pokušajte ponovo.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (items.length === 0) {
        return <div>Učitavanje...</div>;
    }

    return (
        <div className="checkout-container">
            <h2>Završetak Kupovine</h2>
            <div className="order-summary">
                <h3>Pregled porudžbine:</h3>
                <p>Naziv: <strong>{items[0].naziv}</strong></p>
                <p>Cena: <strong>{items[0].cena}€</strong></p>
                {/* Ovde možeš dodati mapiranje ako ima više kurseva */}
            </div>
            
            <form onSubmit={handleSubmit} className="checkout-form">
                <h3>Vaši podaci</h3>
                <div className="form-group">
    <label htmlFor="ime">Ime</label>
    <input 
        type="text" 
        id="ime" 
        value={ime} 
        onChange={(e) => setIme(e.target.value)} 
        placeholder="Unesite Vaše ime"
        required 
    />
</div>
<div className="form-group">
    <label htmlFor="prezime">Prezime</label>
    <input 
        type="text" 
        id="prezime" 
        value={prezime} 
        onChange={(e) => setPrezime(e.target.value)} 
        placeholder="Unesite Vaše prezime"
        required 
    />
</div>
<div className="form-group">
    <label htmlFor="email">Email adresa</label>
    <input 
        type="email" 
        id="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        placeholder="primer@gmail.com"
        required 
    />
</div>
                
                {error && <p className="error-message">{error}</p>}
                
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Obrada...' : 'Pređi na plaćanje'}
                </button>
            </form>
        </div>
    );
};

export default Checkout;
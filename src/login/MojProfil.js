import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth';
import api from './api';
import './MojProfil.css';
import { useNavigate } from 'react-router-dom';

const MojProfil = () => {
    const { user, logout, setUser: setAuthUser } = useAuth();
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        ime: '',
        prezime: '',
        email: '',
        currentPassword: '',
        newPassword: ''
    });

    // NOVI STATE: Čuvamo listu svih kupljenih kurseva
    const [kupljeniKursevi, setKupljeniKursevi] = useState([]);
    
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Provera da li je trenutna pretplata aktivna
    const imaAktivnuPretplatu = user && user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();

    const fetchData = useCallback(async () => {
        if (user) {
            setFormData({
                ime: user.ime || '',
                prezime: user.prezime || '',
                email: user.email || '',
                currentPassword: '',
                newPassword: ''
            });
            try {
                // Dohvatamo sve kurseve koje je korisnik ikada kupio
                const response = await api.get(`/api/kupovina/user/${user.id}`);
                setKupljeniKursevi(response.data);
            } catch (error) {
                console.error('Greška pri dohvatanju kupljenih kurseva:', error);
            }
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({ ...prevState, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        try {
            const profileUpdateData = {
                ime: formData.ime,
                prezime: formData.prezime,
                email: formData.email,
            };
            if (formData.currentPassword && formData.newPassword) {
                await api.post('/api/auth/change-password', {
                    currentPassword: formData.currentPassword,
                    newPassword: formData.newPassword
                });
            }
            await api.put(`/api/korisnici/${user.id}`, profileUpdateData);
            
            const response = await api.get('/api/auth/me');
            setAuthUser(response.data);
            localStorage.setItem('user', JSON.stringify(response.data));

            setMessage('Profil je uspešno ažuriran!');
            setFormData(prevState => ({ ...prevState, currentPassword: '', newPassword: '' }));
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Došlo je do greške.';
            setMessage(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleProduziPretplatu = async (kurs) => {
        try {
            const response = await api.post('/api/placanje/kreiraj-checkout', {
                kurs_id: kurs.id,
                ime: user.ime,
                prezime: user.prezime,
                email: user.email,
            });
            if (response.data.url) {
                window.location.href = response.data.url;
            }
        } catch (error) {
            console.error("Greška pri produžavanju pretplate:", error);
        }
    };

    if (!user) {
        return <div className="profil-container"><p>Molimo vas da se ulogujete.</p></div>;
    }

    return (
        <div className="profil-container">
            <div className="profil-content-wrapper">
                {/* --- Leva Kartica - Profil --- */}
                <div className="profil-card">
                    <h2 className="profil-header">Moj Profil</h2>
                    <form onSubmit={handleSubmit} className="profil-form">
                        {/* ... input polja ostaju ista ... */}
                        <div className="profil-form-group">
                            <label htmlFor="ime">Ime</label>
                            <input id="ime" name="ime" type="text" value={formData.ime} onChange={handleInputChange} required />
                        </div>
                        <div className="profil-form-group">
                            <label htmlFor="prezime">Prezime</label>
                            <input id="prezime" name="prezime" type="text" value={formData.prezime} onChange={handleInputChange} required />
                        </div>
                        <div className="profil-form-group">
                            <label htmlFor="email">Email</label>
                            <input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                        </div>
                        <hr className="profil-divider" />
                        <h3 className="profil-subheader">Promena Lozinke</h3>
                        <div className="profil-form-group">
                            <label htmlFor="currentPassword">Trenutna Lozinka</label>
                            <input id="currentPassword" name="currentPassword" type="password" value={formData.currentPassword} onChange={handleInputChange} placeholder="Unesite za promenu lozinke" />
                        </div>
                        <div className="profil-form-group">
                            <label htmlFor="newPassword">Nova Lozinka</label>
                            <input id="newPassword" name="newPassword" type="password" value={formData.newPassword} onChange={handleInputChange} placeholder="Ostavite prazno ako ne menjate" />
                        </div>
                        {message && <p className="profil-message">{message}</p>}
                        <button type="submit" className="profil-submit-btn" disabled={isLoading}>
                            {isLoading ? 'Ažuriranje...' : 'Sačuvaj Promene'}
                        </button>
                    </form>
                </div>

                {/* --- Desna Kartica - Pretplate --- */}
                <div className="pretplata-card">
                    <h2 className="profil-header">Moje Pretplate</h2>
                    {kupljeniKursevi.length > 0 ? (
                        <ul className="pretplata-list">
                            {kupljeniKursevi.map(kurs => (
                                <li key={kurs.id} className="pretplata-item">
                                    <div className="pretplata-info">
                                        <span className="pretplata-item-name">{kurs.naziv}</span>
                                        <span className="pretplata-item-date">
                                            Kupljeno: {new Date(kurs.datum_kupovine).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="pretplata-status">
                                        {kurs.is_subscription ? (
                                            imaAktivnuPretplatu ? (
                                                <span className="status-active">
                                                    Aktivna do: {new Date(user.subscription_expires_at).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <div className="status-expired">
                                                    <span>Pretplata istekla!</span>
                                                    <button onClick={() => handleProduziPretplatu(kurs)} className="produzi-pretplatu-btn">
                                                        Produži
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            <span className="status-permanent">Trajni pristup</span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="pretplata-empty">Nemate aktivnih kupovina ili pretplata.</p>
                    )}
                </div>
            </div>
            <button onClick={logout} className="profil-logout-btn">Odjavi se</button>
        </div>
    );
};

export default MojProfil;
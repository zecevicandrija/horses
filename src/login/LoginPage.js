import React, { useState } from 'react';
import { useAuth } from './auth';
import './LoginPage.css'

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [sifra, setSifra] = useState('');
  const [showModal, setShowModal] = useState(false); // State za prikaz modala
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await login(email, sifra);
    } catch (error) {
      setShowModal(true); // Prikazivanje modala u slučaju greške
      console.error('Login error:', error);
    }
  };

  const closeModal = () => {
    setShowModal(false); // Funkcija za zatvaranje modala
  };

 return (
    <div className="login-page-wrapper">
        <div className="login-container">
            <div className="login-card-header">
                <h2 className="login-title">Prijavljivanje</h2>
                <div className="title-underline"></div>
            </div>

            <form onSubmit={handleSubmit} className="login-form-content">
                <div className="form-input-group">
                    <label htmlFor="email">Email Adresa</label>
                    <div className="input-with-icon">
                        <i className="icon-email"></i> {/* Opciono: za ikonicu */}
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Vaš email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <div className="form-input-group">
                    <label htmlFor="password">Lozinka</label>
                    <div className="input-with-icon">
                        <i className="icon-lock"></i> {/* Opciono: za ikonicu */}
                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Vaša lozinka"
                            value={sifra}
                            onChange={(e) => setSifra(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <button type="submit" className="submit-login-btn">
                    Prijavi se
                </button>
            </form>
        </div>

        {/* Potpuno redizajnirani modal za greške */}
        {showModal && (
            <div className="error-modal-overlay" onClick={closeModal}>
                <div className="error-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="error-modal-header">
                        <h3>Greška</h3>
                    </div>
                    <div className="error-modal-body">
                        <p>Podaci za prijavu nisu ispravni. Molimo Vas da pokušate ponovo.</p>
                    </div>
                    <div className="error-modal-footer">
                        <button onClick={closeModal} className="close-error-btn">Zatvori</button>
                    </div>
                </div>
            </div>
        )}
    </div>
);
};

export default LoginPage;

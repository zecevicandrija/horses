import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../login/auth'; // Putanja do auth.js
import './Navbar.css';
import { ThemeContext } from '../komponente/ThemeContext';
import motionlogo from '../images/motionacademylogo.png';

const Navbar = () => {
    // --- 1. KORAK: Dohvatamo 'user' i 'loading' stanje ---
    const { user, loading } = useAuth(); 
    const { isDarkTheme, toggleTheme } = useContext(ThemeContext);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [cartItems, setCartItems] = useState([]);

    useEffect(() => {
        const updateCartItems = () => {
            const storedCart = JSON.parse(localStorage.getItem('cart')) || [];
            setCartItems(storedCart);
        };

        updateCartItems();
        window.addEventListener('storage', updateCartItems);
        window.addEventListener('cart-updated', updateCartItems);

        return () => {
            window.removeEventListener('storage', updateCartItems);
            window.removeEventListener('cart-updated', updateCartItems);
        };
    }, []);

    const handleMenuToggle = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const cartItemCount = cartItems.length;

    const closeMobileMenu = () => {
        setIsMenuOpen(false);
    };

    // --- 2. KORAK: Uslov za prikazivanje navbara ---
    // Ako se sesija još uvek proverava (loading === true) ili ako korisnik nije ulogovan (user === null),
    // komponenta ne vraća ništa (vraća null).
    if (loading || !user) {
        return null;
    }

    // Ako provera prođe (korisnik je ulogovan), prikazuje se ostatak komponente.
    return (
        <nav className={`navbar ${isDarkTheme ? 'dark' : ''}`}>
            <div className="navbar-container">
                <div className="navbar-left">
                    <Link to="/" className="navbar-logo">
                        <img src={motionlogo} alt='logo' className='logo' />
                    </Link>
                </div>

                <div className="navbar-right">
                    <ul className={`navbar-menu ${isMenuOpen ? 'active' : ''}`}>
                        <li className="navbar-item">
                            <Link to="/" className="navbar-link" onClick={closeMobileMenu}>POČETNA</Link>
                        </li>
                        {/* <li className="navbar-item">
                            <Link to="/kurs/1" className="navbar-link" onClick={closeMobileMenu}>LEKCIJE</Link>
                        </li> */}
                        
                        {/* Sada više ne moramo da proveravamo da li korisnik postoji ovde, 
                          jer se cela komponenta neće prikazati ako nije ulogovan.
                          Ali radi sigurnosti, ostavićemo kod kakav jeste.
                        */}
                        {user && (
                            <>
                                <li className="navbar-item">
                                    <Link to="/kupljenkurs" className="navbar-link" onClick={closeMobileMenu}>LEKCIJE</Link>
                                </li>
                                <li className="navbar-item">
                                    <Link to="/korpa" className="navbar-link cart-icon" onClick={closeMobileMenu}>
                                        <i className="ri-shopping-cart-2-line"></i>
                                        {cartItemCount > 0 && (
                                            <span className="cart-badge">{cartItemCount}</span>
                                        )}
                                    </Link>
                                </li>
                                <li className="navbar-item">
                                    <Link to="/profil" className="navbar-link acc-icon" onClick={closeMobileMenu}>
                                        <i className="ri-account-circle-line"></i>
                                    </Link>
                                </li>

                                {(user.uloga === 'admin' || user.uloga === 'instruktor') && (
                                    <li className="navbar-item">
                                        <Link to="/instruktor" className="navbar-link chart" onClick={closeMobileMenu}>
                                            <i className="ri-line-chart-line"></i>
                                        </Link>
                                    </li>
                                )}
                            </>
                        )}
                    </ul>
                </div>

                <button className="navbar-hamburger" onClick={handleMenuToggle}>
                    <i className="ri-menu-line"></i>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
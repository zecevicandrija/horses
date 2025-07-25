import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../login/auth';
import './Navbar.css';
import undologoo from '../images/undologoo.jpg';
import { ThemeContext } from '../komponente/ThemeContext'; // Import ThemeContext
import motionlogo from '../images/motionacademylogo.png'

const Navbar = () => {
    const { user, logout } = useAuth();
    const { isDarkTheme, toggleTheme } = useContext(ThemeContext); // Get the theme context
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [cartItems, setCartItems] = useState([]);

    useEffect(() => {
        const updateCartItems = () => {
            const storedCart = JSON.parse(localStorage.getItem('cart')) || [];
            setCartItems(storedCart);
        };

        // Update cart items on component mount
        updateCartItems();

        // Listen for changes to localStorage and custom event
        window.addEventListener('storage', updateCartItems);
        window.addEventListener('cart-updated', updateCartItems);

        // Clean up the event listener on component unmount
        return () => {
            window.removeEventListener('storage', updateCartItems);
            window.removeEventListener('cart-updated', updateCartItems);
        };
    }, []); // Empty dependency list to run only once

    const handleMenuToggle = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const cartItemCount = cartItems.length; // Ensure it's a number

    const closeMobileMenu = () => {
    setIsMenuOpen(false);
};

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
                        <li className="navbar-item">
                            <Link to="/kursevi" className="navbar-link" onClick={closeMobileMenu}>KURSEVI</Link>
                        </li>
                        {/* <li className="navbar-item">
                            <Link to="/o-nama" className="navbar-link">O NAMA</Link>
                        </li>
                        <li className="navbar-item">
                            <Link to="/usluge" className="navbar-link">USLUGE</Link>
                        </li>
                        <li className="navbar-item">
                            <Link to="/kontakt" className="navbar-link">KONTAKT</Link>
                        </li> */}

                        {!user ? (
                            <>
                                <li className="navbar-item auth-item">
                                    <Link to="/login" className="navbar-link" onClick={closeMobileMenu}>LOGIN</Link>
                                </li>
                                {/* <li className="navbar-item auth-item">
                                    <Link to="/signup" className="navbar-link register-link" onClick={closeMobileMenu}>REGISTRACIJA</Link>
                                </li> */}
                            </>
                        ) : (
                            <>
                                <li className="navbar-item">
                                    <Link to="/kupljenkurs" className="navbar-link" onClick={closeMobileMenu}>MOJI KURSEVI</Link>
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

                        {/* <li className="navbar-item theme-item">
                            <button className="theme-toggle-button" onClick={toggleTheme}>
                                {isDarkTheme ? (
                                    <i className="ri-moon-line"></i>
                                ) : (
                                    <i className="ri-sun-line"></i>
                                )}
                            </button>
                        </li> */}
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

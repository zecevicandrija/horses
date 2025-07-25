import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../login/auth';
import './Korpa.css';

const Korpa = () => {
    const [courseDetails, setCourseDetails] = useState([]);
    const [total, setTotal] = useState(0);
    const [discountCode, setDiscountCode] = useState('');
    const [discountId, setDiscountId] = useState(null);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [courseToRemove, setCourseToRemove] = useState(null);
    
    const navigate = useNavigate();
    const { user } = useAuth();

    const fetchCartDetails = useCallback(async () => {
        const storedCart = JSON.parse(localStorage.getItem('cart')) || [];
        
        if (storedCart.length === 0) {
            setCourseDetails([]);
            setTotal(0);
            return;
        }

        try {
            const details = await Promise.all(
                storedCart.map(async (course) => {
                    if (!course.id) return null;
                    try {
                        const [ratingRes, lessonsRes, instructorRes] = await Promise.all([
                            axios.get(`http://localhost:5000/api/ratings/average/${course.id}`),
                            axios.get(`http://localhost:5000/api/lekcije/count/${course.id}`),
                            axios.get(`http://localhost:5000/api/korisnici`) // Fetch all users to find instructor
                        ]);

                        const instructors = {};
                        instructorRes.data.forEach(u => {
                            if (u.uloga === 'instruktor' || u.uloga === 'admin') {
                                instructors[String(u.id)] = u.ime + ' ' + u.prezime;
                            }
                        });

                        return {
                            ...course,
                            rating: ratingRes.data.averageRating ?? 0,
                            lessonCount: lessonsRes.data.lessonCount ?? 0,
                            instructorName: instructors[String(course.instruktor_id)] || 'Nepoznat'
                        };
                    } catch (error) {
                        console.error(`Error fetching details for course ${course.id}:`, error);
                        return { ...course, rating: 0, lessonCount: 0, instructorName: 'Nepoznat' }; // Vrati osnovne podatke u slučaju greške
                    }
                })
            );

            const validDetails = details.filter(Boolean); // Ukloni null vrednosti ako je bilo grešaka
            setCourseDetails(validDetails);
            
            const totalPrice = validDetails.reduce((acc, item) => acc + Number(item.cena || 0), 0);
            setTotal(totalPrice);

        } catch (error) {
            console.error("Error fetching course details:", error);
        }
    }, []); // Prazan niz zavisnosti jer ova funkcija ne zavisi od spoljnih promenljivih

    useEffect(() => {
        fetchCartDetails();
    }, [fetchCartDetails]);

    const handleRemoveFromCart = (course) => {
        setCourseToRemove(course);
        setShowRemoveModal(true);
    };

    const confirmRemoveFromCart = () => {
        if (!courseToRemove) return;
        const updatedCart = courseDetails.filter(item => item.id !== courseToRemove.id);
        setCourseDetails(updatedCart);
        localStorage.setItem('cart', JSON.stringify(updatedCart));
        
        const newTotal = updatedCart.reduce((acc, item) => acc + Number(item.cena || 0), 0);
        setTotal(newTotal);

        setShowRemoveModal(false);
        setCourseToRemove(null);
    };

    const applyDiscount = async () => {
        try {
            const response = await axios.post('http://localhost:5000/api/popusti/validate', { code: discountCode });
            if (response.data.valid) {
                const discountPercent = response.data.discountPercent;
                setDiscountId(response.data.discountId);
                
                const originalTotal = courseDetails.reduce((acc, item) => acc + Number(item.cena || 0), 0);
                const discountAmount = (originalTotal * discountPercent) / 100;
                setTotal(originalTotal - discountAmount);
                alert(`Popust od ${discountPercent}% je primenjen.`);
            } else {
                alert(response.data.message || 'Neispravan kod za popust.');
            }
        } catch (error) {
            console.error('Error applying discount:', error);
            alert('Greška pri primeni popusta.');
        }
    };

    const handlePurchase = () => {
        // Jedina uloga "Kupi" dugmeta je da nas odvede na checkout stranicu
        // i prosledi joj podatke o kursevima i ukupnoj ceni.
        navigate('/checkout', { state: { items: courseDetails, total: total } });
    };

    return (
        <div className="korpa-container">
            <h2>Vaša korpa</h2>
            {courseDetails.length > 0 ? (
                <>
                    <div className="korpa-items-list">
                        {courseDetails.map((course) => (
                            <div className="korpa-item" key={course.id}>
                                <img src={course.slika} alt={course.naziv} className="korpa-course-image" />
                                <div className="korpa-course-info">
                                    <h3>{course.naziv}</h3>
                                    <p><strong>Instruktor:</strong> {course.instructorName}</p>
                                    <p><strong>Cena:</strong> {course.cena}$</p>
                                    <p><strong>Broj lekcija:</strong> {course.lessonCount}</p>
                                    <button onClick={() => handleRemoveFromCart(course)} className="korpa-remove-button">Ukloni</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="korpa-summary">
                        <h2>Ukupno</h2>
                        <p className="total-price">{total.toFixed(2)}$</p>
                        <div className="discount-section">
                            <input
                                type="text"
                                value={discountCode}
                                onChange={(e) => setDiscountCode(e.target.value)}
                                placeholder="Unesite kod za popust"
                            />
                            <button onClick={applyDiscount}>Primeni</button>
                        </div>
                        <button onClick={handlePurchase} className="korpa-purchase-button">
                            Idi na plaćanje
                        </button>
                    </div>
                </>
            ) : (
                <p>Nema kurseva u korpi.</p>
            )}

            {showRemoveModal && (
                <div className="remove-modal">
                    <div className="remove-modal-content">
                        <h4>Da li ste sigurni da želite da uklonite ovaj kurs iz korpe?</h4>
                        <button onClick={confirmRemoveFromCart} className="remove-modal-confirm-button">Potvrdi</button>
                        <button onClick={() => setShowRemoveModal(false)} className="remove-modal-cancel-button">Odustani</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Korpa;
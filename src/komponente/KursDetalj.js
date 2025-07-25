// src/components/KursDetalj.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../login/api.js';
import { useAuth } from '../login/auth.js';
import ReactStars from 'react-stars';
import './KursDetalj.css';
import Komentari from '../Instruktori/Komentari.js';
import PrikazKviza from './PrikazKviza.js';
import Editor from '@monaco-editor/react';
import ReactPlayer from 'react-player';
import Hls from 'hls.js';

if (typeof window !== "undefined" && !window.Hls) {
  window.Hls = Hls;
}

const PlayIcon = () => <i className="icon-play"></i>;
const AssignmentIcon = () => <i className="icon-assignment"></i>;
const HeartIcon = ({ filled }) => <i className={filled ? "icon-heart-filled" : "icon-heart"}></i>;


const KursDetalj = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [kurs, setKurs] = useState(null);
    const [lekcije, setLekcije] = useState([]);
    // NOVO: Dodajemo state za sekcije
    const [sekcije, setSekcije] = useState([]);
    const [otvorenaLekcija, setOtvorenaLekcija] = useState(null);
    const [wishlisted, setWishlisted] = useState(false);
    const [kupioKurs, setKupioKurs] = useState(false);
    const [rating, setRating] = useState(0);
    const [completedLessons, setCompletedLessons] = useState(new Set());
    const [quiz, setQuiz] = useState([]);
    const [code, setCode] = useState('// Unesite svoj kod ovde');
    const [language, setLanguage] = useState('javascript');
    const [showEditor, setShowEditor] = useState(false);
    const [savedCodes, setSavedCodes] = useState({});
    const [reviewFeedback, setReviewFeedback] = useState(null);
    // IZMENA: Active section sada čuva ID sekcije (broj), a ne naziv
    const [activeSection, setActiveSection] = useState(null);
    const [currentStreamUrl, setCurrentStreamUrl] = useState('');

    const imaAktivnuPretplatu = user && user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Paralelno dobavljanje podataka radi bržeg učitavanja
                const [kursResponse, lekcijeResponse, sekcijeResponse] = await Promise.all([
                    api.get(`/api/kursevi/${id}`),
                    api.get(`/api/lekcije/course/${id}`),
                    // NOVO: Pozivamo naš novi endpoint za dobavljanje sekcija
                    api.get(`/api/lekcije/sections/${id}`)
                ]);

                setKurs(kursResponse.data);
                setLekcije(lekcijeResponse.data);
                // NOVO: Postavljamo sekcije u state
                setSekcije(sekcijeResponse.data);

                // ISPRAVLJENO: Postavljanje prve sekcije kao aktivne na osnovu novih podataka
                if (sekcijeResponse.data.length > 0) {
                    // Postavljamo ID prve sekcije kao aktivan
                    setActiveSection(sekcijeResponse.data[0].id);
                }

                if (user) {
                    const kupovinaResponse = await api.get(`/api/kupovina/user/${user.id}`);
                    const purchased = kupovinaResponse.data.find(c => c.id === +id);
                    setKupioKurs(!!purchased);

                    if (purchased) {
                        try {
                            const ratingResponse = await api.get(`/api/ratings/user/${user.id}/course/${id}`);
                            setRating(ratingResponse.data.ocena || 0);
                        } catch { /* nema ocene */ }
                    }

                    // Logika za kompletirane lekcije i wishlist ostaje ista
                    const completedResponse = await api.get(`/api/kompletirane_lekcije/user/${user.id}/course/${id}`);
                    setCompletedLessons(new Set(completedResponse.data)); // Backend sada vraća samo niz ID-jeva

                    const wishlistResponse = await api.get(`/api/wishlist/check`, {
                        params: { korisnik_id: user.id, kurs_id: id }
                    });
                    setWishlisted(wishlistResponse.data.exists);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };
        fetchData();
    }, [id, user]);


    const handleLessonClick = async (lekcijaId) => {
        if (!kupioKurs && !isCourseAccessible) return;
        const lekcija = lekcije.find(l => l.id === lekcijaId);
        if (!lekcija) return;
    
        setOtvorenaLekcija(lekcija);
        setCurrentStreamUrl('');
        setReviewFeedback(null);
    
        if (lekcija.video_url) {
            try {
                const response = await api.get(`/api/lekcije/${lekcija.id}/stream`);
                setCurrentStreamUrl(response.data.url);
            } catch (error) {
                console.error("Greška pri dohvatanju video linka:", error);
                alert("Nije moguće učitati video.");
                setCurrentStreamUrl('error');
            }
        }
    
        await fetchQuiz(lekcijaId);
    
        if (lekcija.assignment) {
            setShowEditor(true);
            determineLanguage(lekcija.assignment);
            setCode(savedCodes[lekcijaId] || getDefaultCode(language));
        } else {
            setShowEditor(false);
        }
    };
    

    const handleCompletionToggle = async (lessonId) => {
        if (!user) return;
        
        const isCompleted = completedLessons.has(lessonId);
        const updatedCompletedLessons = new Set(completedLessons);
    
        try {
            if (isCompleted) {
                // Logika za brisanje kompletirane lekcije (ako je potrebno)
                // const response = await api.delete(`/api/kompletirane_lekcije/user/${user.id}/lesson/${lessonId}`);
                // if (response.status === 200) {
                //     updatedCompletedLessons.delete(lessonId);
                // }
                console.log("Logika za un-check još nije implementirana na backendu.");
                // Za sada, samo vizuelno uklanjamo
                updatedCompletedLessons.delete(lessonId);
    
            } else {
                // Dodavanje nove kompletirane lekcije
                await api.post('/api/kompletirane_lekcije', {
                    korisnik_id: user.id,
                    kurs_id: id,
                    lekcija_id: lessonId
                });
                updatedCompletedLessons.add(lessonId);
            }
            setCompletedLessons(updatedCompletedLessons);
        } catch (err) {
            console.error("Greška pri ažuriranju statusa lekcije:", err);
            // Vraćamo checkbox u prethodno stanje ako je došlo do greške
        }
    };
    


    // ... Ostatak funkcija (handleWishlistToggle, handleAddToCart, itd.) ostaje nepromenjen ...
    const fetchQuiz = async (lessonId) => {
        try {
            const { data } = await api.get(`/api/kvizovi/lesson/${lessonId}`);
            const parsed = data.pitanja.map(p => ({
                ...p,
                answers: Array.isArray(p.answers) ? p.answers : JSON.parse(p.answers)
            }));
            setQuiz(parsed);
        } catch (e) {
            setQuiz([]); // Resetuj kviz ako nema pitanja ili dođe do greške
        }
    };
    const determineLanguage = (assignment) => {
        const text = assignment.toLowerCase();
        if (text.includes('react') || text.includes('jsx')) setLanguage('javascript');
        else if (text.includes('html')) setLanguage('html');
        else if (text.includes('css')) setLanguage('css');
        else setLanguage('javascript');
    };

    const getDefaultCode = (lang) => {
        switch (lang) {
            case 'html':
                return '<!DOCTYPE html>\n<html>\n<head>\n  <title>Page Title</title>\n</head>\n<body>\n\n</body>\n</html>';
            case 'css':
                return '/* Add your CSS here */\nbody {\n  margin: 0;\n  padding: 0;\n}';
            default:
                return '// Unesite svoj JavaScript kod ovde';
        }
    };

    const handleSaveCode = async () => {
        if (!otvorenaLekcija?.id || !user) return;
        try {
            await api.post('/api/saved-codes', {
                user_id: user.id,
                lesson_id: otvorenaLekcija.id,
                code,
                language
            });
            setSavedCodes({ ...savedCodes, [otvorenaLekcija.id]: code });
            alert('Kod je uspešno sačuvan!');
        } catch {
            alert('Došlo je do greške pri čuvanju koda');
        }
    };

    const handleWishlistToggle = async () => {
        if (!user) return;
        try {
            if (wishlisted) {
                await api.delete('/api/wishlist', { data: { korisnik_id: user.id, kurs_id: id } });
                setWishlisted(false);
            } else {
                await api.post('/api/wishlist', { korisnik_id: user.id, kurs_id: id });
                setWishlisted(true);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddToCart = () => {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (!cart.find(c => c.id === kurs.id)) {
            localStorage.setItem('cart', JSON.stringify([...cart, kurs]));
            window.dispatchEvent(new Event('cart-updated'));
        }
        navigate('/korpa');
    };

    const handleRatingSubmit = async () => {
        if (!user || !kupioKurs || !rating) return;
        try {
            await api.post('/api/ratings', { korisnik_id: user.id, kurs_id: id, ocena: rating });
            alert('Uspešno ste ocenili kurs!');
        } catch {
            alert('Došlo je do greške pri ocenjivanju');
        }
    };

    const handleReviewCode = async () => {
        try {
            const { data } = await api.post('/api/lekcije/deepseek-review', { code, language });
            if (data.success) setReviewFeedback({ message: data.message });
            else setReviewFeedback({ message: 'AI nije vratio validan odgovor.', error: data.error });
        } catch (error) {
            setReviewFeedback({ message: 'Greška pri proveri koda.', error: error.message });
        }
    };

    const handleProduziPretplatu = async () => {
        if (!user) return navigate('/login');
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
            alert("Došlo je do greške, molimo pokušajte ponovo.");
        }
    };

    // UKLONJENO: Stara, neispravna logika za grupisanje
    // const groupedLessons = lekcije.reduce((acc, l) => {
    //  (acc[l.section] ||= []).push(l);
    //  return acc;
    // }, {});

    if (!kurs) return <div className="loading">Učitavanje...</div>;

    const isCourseAccessible = kupioKurs && (!kurs.is_subscription || imaAktivnuPretplatu);


    return (
        <div className="course-detail-page">
            <div className="course-header">
                <div className="header-content">
                    <h1 className="course-title-header">{kurs.naziv}</h1>
                    <p className="course-subtitle">{kurs.opis}</p>
                    <p className="course-meta-header">
                        Kreirano: {new Date(kurs.created_at).toLocaleDateString()}
                    </p>
                </div>
            </div>
    
            <div className="course-layout-wrapper">
                <aside className="sidebar-left">
                    <div className="sidebar-sticky-content">
                        <div className="course-actions-card">
                            {/* ... Ostatak JSX-a za akcije ostaje isti ... */}
                            {!kupioKurs ? (
                                    <>
                                        <div className="price-tag">{kurs.cena} RSD</div>
                                        <button onClick={handleAddToCart} className="btn btn-purchase">Dodaj u korpu</button>
                                        <button onClick={handleWishlistToggle} className="btn btn-wishlist">
                                            <HeartIcon filled={wishlisted} />
                                            {wishlisted ? 'Ukloni iz liste želja' : 'Dodaj u listu želja'}
                                        </button>
                                    </>
                                ) : (
                                    <div className="rating-section">
                                        <h4>Ocenite kurs</h4>
                                        <ReactStars
                                            count={5}
                                            value={rating}
                                            onChange={setRating}
                                            size={30}
                                            color2="#ffd700"
                                        />
                                        <button
                                            onClick={handleRatingSubmit}
                                            className="btn btn-primary"
                                            disabled={!rating}
                                        >
                                            Pošalji ocenu
                                        </button>
                                    </div>
                                )}
                        </div>
    
                        <div className="lessons-list-card">
                            <h4>Sadržaj kursa</h4>
                            {/* ISPRAVLJENO: Nova logika za prikaz sekcija i lekcija */}
                            {sekcije.map(sekcija => (
                                <div key={sekcija.id} className="lesson-section">
                                    <h5
                                        className="section-header"
                                        onClick={() => setActiveSection(activeSection === sekcija.id ? null : sekcija.id)}
                                    >
                                        {sekcija.naziv}
                                        <span className={`chevron ${activeSection === sekcija.id ? 'expanded' : ''}`} />
                                    </h5>
                                    {activeSection === sekcija.id && (
                                        <ul className="lessons-list">
                                            {lekcije
                                                .filter(l => l.sekcija_id === sekcija.id)
                                                .map(lekcija => (
                                                    <li
                                                        key={lekcija.id}
                                                        className={`lesson-item ${otvorenaLekcija?.id === lekcija.id ? 'active' : ''} ${!isCourseAccessible ? 'disabled' : ''}`}
                                                        onClick={() => isCourseAccessible && handleLessonClick(lekcija.id)}
                                                    >
                                                        <div className="lesson-item-title">
                                                            {lekcija.assignment ? <AssignmentIcon /> : <PlayIcon />}
                                                            <span>{lekcija.title}</span>
                                                        </div>
                                                        {isCourseAccessible && (
                                                            <input
                                                                type="checkbox"
                                                                checked={completedLessons.has(lekcija.id)}
                                                                onChange={e => {
                                                                    e.stopPropagation();
                                                                    handleCompletionToggle(lekcija.id);
                                                                }}
                                                                title="Označi kao završeno"
                                                                className="lesson-complete-checkbox"
                                                            />
                                                        )}
                                                    </li>
                                                ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
    
                <div className="main-content-right">
                    {/* ... Ostatak JSX-a za glavni sadržaj ostaje isti ... */}
                    {!kupioKurs ? (
                                 <div className="welcome-card state-cta">
                                     <h2>Kupite kurs da biste pristupili sadržaju</h2>
                                     <p>Dodajte ga u korpu i započnite učenje danas!</p>
                                     <button onClick={handleAddToCart} className="btn-purchase large">Dodaj u korpu</button>
                                 </div>
                             ) : !isCourseAccessible ? (
                                <div className="welcome-card state-expired">
                                    <h2>Vaša pretplata je istekla!</h2>
                                    <p>Da biste nastavili sa pristupom ovom kursu, molimo Vas da produžite svoju pretplatu.</p>
                                    <button onClick={handleProduziPretplatu} className="btn-purchase large">Produži Pretplatu</button>
                                </div>
                            ) : !otvorenaLekcija ? (
                                <div className="welcome-card state-info">
                                    <h2>Dobrodošli nazad!</h2>
                                    <p>Izaberite lekciju iz menija sa leve strane da biste nastavili sa učenjem.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="content-display-area">
                                        <div className="lesson-player-card">
                                            <h3>{otvorenaLekcija.title}</h3>
                                            {otvorenaLekcija.video_url && (
                                                <div className='player-wrapper'>
                                                    {!currentStreamUrl && <div className="player-placeholder">Učitavanje videa...</div>}
                                                    {currentStreamUrl === 'error' && <div className="player-placeholder">Greška pri učitavanju videa.</div>}
                                                    {currentStreamUrl && currentStreamUrl !== 'error' && (
                                                        <iframe
                                                            src={currentStreamUrl}
                                                            allowtransparency="true"
                                                            loading="lazy"
                                                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                                            allowFullScreen={true}
                                                            style={{
                                                                position: 'absolute',
                                                                top: 0,
                                                                left: 0,
                                                                width: '100%',
                                                                height: '100%',
                                                                border: 'none',
                                                            }}
                                                        ></iframe>
                                                    )}
                                                </div>
                                            )}
                                            <p className="lesson-content-text">{otvorenaLekcija.content}</p>
                                        </div>
                                    </div>

                                    {otvorenaLekcija.assignment && (
                                        <div className="assignment-card">
                                            <h3>Zadatak</h3>
                                            <p className="assignment-text">{otvorenaLekcija.assignment}</p>
                                            {showEditor && (
                                                <div className="code-editor-wrapper">
                                                    <div className="editor-header">
                                                        <h4>Code Editor</h4>
                                                        <select value={language} onChange={e => setLanguage(e.target.value)}>
                                                            <option value="javascript">JavaScript</option>
                                                            <option value="html">HTML</option>
                                                            <option value="css">CSS</option>
                                                        </select>
                                                    </div>
                                                    <Editor
                                                        height="400px"
                                                        language={language}
                                                        theme="vs-dark"
                                                        value={code}
                                                        onChange={setCode}
                                                        options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on' }}
                                                    />
                                                    <div className="editor-actions">
                                                        <button className="btn btn-secondary" onClick={handleSaveCode}>Sačuvaj Kod</button>
                                                        <button className="btn btn-primary" onClick={handleReviewCode}>Proveri Kod (AI)</button>
                                                    </div>
                                                    {reviewFeedback && (
                                                        <div className="ai-feedback">
                                                            <h4>AI Povratna Informacija:</h4>
                                                            <pre>{reviewFeedback.message}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {quiz && quiz.length > 0 && (
                                        <PrikazKviza quizData={quiz} />
                                    )}
                                </>
                            )}
                </div>
            </div>
        </div>
    );
};

export default KursDetalj;
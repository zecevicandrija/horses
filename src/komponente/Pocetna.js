import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Pocetna.css';
import filip2 from '../images/filip2.png'; // Pretpostavljena putanja do slike

// Ikonice
const PlayIcon = () => <i className="ri-play-circle-line"></i>;
const ChevronIcon = ({ isOpen }) => <i className={`ri-arrow-down-s-line accordion-chevron ${isOpen ? 'open' : ''}`}></i>;

// --- Komponenta za Hero sekciju ---
const HeroSection = ({ navigate }) => (
    <section className="hero-section">
        <div className="container">
            <h1 className="hero-title">
                Postani <span className="highlight-text">Video Editor</span> i Unovči Svoju Kreativnost
            </h1>
            <p className="hero-subtitle">
                Naš sveobuhvatni kurs te vodi od potpunog početnika do profesionalca spremnog za rad na stvarnim projektima. Uči tempom koji ti odgovara, uz podršku mentora.
            </p>
            <div className="hero-video-showcase" onClick={() => alert('Otvaranje videa...')}>
                <img src="https://andrijatest.b-cdn.net/slika-kursa-1752491711321-motionacademybanner.png" alt="Uvodni video" className="video-thumbnail" />
                <div className="video-overlay">
                    <PlayIcon />
                    <span>Pogledaj Uvodni Video</span>
                </div>
            </div>
            <div className="hero-cta-group">
                <button className="cta-button primary" onClick={() => navigate('/kursevi')}>Pogledaj Kurseve</button>
            </div>
        </div>
    </section>
);

// --- Komponenta za "Šta dobijaš" sekciju ---
const FeaturesSection = ({ navigate }) => {
    const features = [
        { icon: 'ri-movie-2-line', title: 'Preko 20 sati materijala', text: 'Detaljne video lekcije koje pokrivaju sve aspekte montaže.' },
        { icon: 'ri-folder-zip-line', title: 'Svi Potrebni Materijali', text: 'Pristup sirovim snimcima i projektima za vežbu.' },
        { icon: 'ri-community-line', title: 'Zajednica Polaznika', text: 'Poveži se sa drugim studentima i razmenjuj iskustva.' },
        { icon: 'ri-award-line', title: 'Sertifikat o Završetku', text: 'Dokaz o stečenom znanju koji možeš dodati u svoj CV.' },
    ];
    return (
        <section className="section">
            <div className="container">
                <h2 className="section-title">Šta Sve Dobijaš Unutar Kursa?</h2>
                <div className="features-grid">
                    {features.map((feature, index) => (
                        <div className="feature-card" key={index}>
                            <i className={feature.icon}></i>
                            <h3>{feature.title}</h3>
                            <p>{feature.text}</p>
                        </div>
                    ))}
                </div>
                <button className="cta-button secondary" onClick={() => navigate('/kursevi')}>Pridruži se generaciji</button>
            </div>
        </section>
    );
};

// --- Komponenta za Testimonijale (POBOLJŠANA VERZIJA) ---
const TestimonialsSection = () => {
    // Niz sada sadrži 5 polaznika kao što je traženo
    const testimonials = [
        { name: 'Marko Marković', text: 'Kurs mi je otvorio oči! Odmah nakon završetka sam dobio prva dva klijenta. Preporuka!', image: 'https://i.pravatar.cc/150?u=marko' },
        { name: 'Jelena Jovanović', text: 'Najbolja investicija u moju karijeru. Mentor je sjajan, a lekcije su jasne i koncizne.', image: 'https://i.pravatar.cc/150?u=jelena' },
        { name: 'Stefan Stefanović', text: 'Mislio sam da znam osnove, ali ovaj kurs me je naučio profesionalnim tehnikama koje su mi donele posao.', image: 'https://i.pravatar.cc/150?u=stefan' },
        { name: 'Ana Anić', text: 'Podrška zajednice je neverovatna. Kad god zapnem, neko je tu da pomogne. Osećaj je sjajan!', image: 'https://i.pravatar.cc/150?u=ana' },
        { name: 'Nikola Nikolić', text: 'Od hobija do profesije za samo par meseci. Materijali su vrhunski, a praktični zadaci zlata vredni.', image: 'https://i.pravatar.cc/150?u=nikola' },
    ];

    const [currentIndex, setCurrentIndex] = useState(0);

    // Ova funkcija pomera karusel na sledeći slajd
    const scrollNext = () => {
        // Koristimo 'window.innerWidth' da odredimo koliko kartica može da se preskoči
        const cardsPerPage = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
        const maxIndex = testimonials.length - cardsPerPage;
        if (currentIndex < maxIndex) {
            setCurrentIndex(prevIndex => prevIndex + 1);
        }
    };

    // Ova funkcija pomera karusel na prethodni slajd
    const scrollPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prevIndex => prevIndex - 1);
        }
    };

    // Određujemo koliko kartica je vidljivo na osnovu širine ekrana za 'disabled' logiku
    const getCardsPerPage = () => {
        if (typeof window !== 'undefined') {
            if (window.innerWidth >= 1024) return 3;
            if (window.innerWidth >= 768) return 2;
        }
        return 1;
    };
    
    const cardsPerPage = getCardsPerPage();
    const isNextDisabled = currentIndex >= testimonials.length - cardsPerPage;

    return (
        <section className="section">
            <div className="container">
                <h2 className="section-title">Šta Kažu Naši Polaznici?</h2>
                <div className="testimonial-carousel-wrapper">
                    <div className="testimonials-grid-container">
                        <div
                            className="testimonials-grid"
                            style={{ '--current-index': currentIndex }}
                        >
                            {testimonials.map((testimonial, index) => (
                                <div className="testimonial-card-wrapper" key={index}>
                                    <div className="testimonial-card">
                                        <p className="testimonial-text">"{testimonial.text}"</p>
                                        <div className="testimonial-author">
                                            <img src={testimonial.image} alt={testimonial.name} />
                                            <span>{testimonial.name}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={scrollPrev} className="scroll-arrow prev" disabled={currentIndex === 0}>
                        <i className="ri-arrow-left-s-line"></i>
                    </button>
                    <button onClick={scrollNext} className="scroll-arrow next" disabled={isNextDisabled}>
                        <i className="ri-arrow-right-s-line"></i>
                    </button>
                </div>
            </div>
        </section>
    );
};

// --- Komponenta za rezultate članova (IZMENJENO SA DUGMETOM) ---
const ResultsSection = ({ navigate }) => {
    const resultsImages = [
        { id: 1, src: filip2, alt: 'Primer rezultata 1' },
        { id: 2, src: filip2, alt: 'Primer rezultata 2' },
        { id: 3, src: filip2, alt: 'Primer rezultata 3' },
        { id: 4, src: filip2, alt: 'Primer rezultata 4' },
    ];

    return (
        <section className="section">
            <div className="container">
                <h2 className="section-title">Pogledaj Neke od Rezultata Članova</h2>
                <p className="section-subtitle">
                    Naši polaznici ne uče samo veštine, već ih uspešno primenjuju i ostvaruju stvarne prihode.
                </p>
                <div className="results-grid">
                    {resultsImages.map(image => (
                        <div className="result-card" key={image.id}>
                            <img src={image.src} alt={image.alt} className="result-image" />
                        </div>
                    ))}
                </div>
                <button className="cta-button primary" onClick={() => navigate('/kursevi')}>Pridruži se Odmah</button>
            </div>
        </section>
    );
};


// --- Komponenta za FAQ ---
const FAQSection = ({ navigate }) => {
    const faqs = [
        { q: 'Koliko dugo imam pristup kursu?', a: 'Pristup svim materijalima je doživotan nakon kupovine. Možete se vraćati na lekcije kad god želite.' },
        { q: 'Da li mi je potrebno prethodno iskustvo?', a: 'Ne. Kurs je dizajniran za potpune početnike i vodi vas korak po korak do naprednog nivoa.' },
        { q: 'Koji softver mi je potreban?', a: 'Kurs se bazira na Adobe Premiere Pro. Prolazimo kroz sve što vam je potrebno da počnete sa radom.' },
        { q: 'Da li dobijam podršku tokom kursa?', a: 'Da! Imate pristup privatnoj zajednici gde možete postavljati pitanja direktno mentoru i drugim polaznicima.' },
    ];
    const [openIndex, setOpenIndex] = useState(null);
    const toggleFAQ = index => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="section">
            <div className="container">
                <h2 className="section-title">Imate Pitanja? Imamo Odgovore!</h2>
                <div className="faq-accordion">
                    {faqs.map((faq, index) => (
                        <div className="accordion-item" key={index}>
                            <button className="accordion-header" onClick={() => toggleFAQ(index)}>
                                <span>{faq.q}</span>
                                <ChevronIcon isOpen={openIndex === index} />
                            </button>
                            <div className={`accordion-content ${openIndex === index ? 'open' : ''}`}>
                                <p>{faq.a}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <button className="cta-button primary" onClick={() => navigate('/kursevi')}>Kreni Sa Učenjem Odmah</button>
            </div>
        </section>
    );
};

// --- Komponenta za Footer (IZMENJENO) ---
const Footer = () => (
    <footer className="footer">
        <div className="container footer-content">
            <p>© {new Date().getFullYear()} MotionAcademy. Sva prava zadržana.</p>
            <div className="social-links">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i className="ri-instagram-line"></i></a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><i className="ri-youtube-line"></i></a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i className="ri-facebook-box-line"></i></a>
            </div>
        </div>
    </footer>
);

// --- Glavna Komponenta Početne Stranice ---
const Pocetna = () => {
    const navigate = useNavigate();
    return (
        <div className="pocetna-wrapper">
            <main className="pocetna-page">
                <HeroSection navigate={navigate} />
                <FeaturesSection navigate={navigate} />
                <TestimonialsSection />
                <ResultsSection navigate={navigate} />
                <FAQSection navigate={navigate} />
            </main>
            <Footer />
        </div>
    );
};

export default Pocetna;
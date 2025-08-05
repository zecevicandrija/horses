import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Pocetna.css';
import rezultat5 from '../images/rezultat31.png';
import rezultat2 from '../images/rezultati23.png'
import rezultat3 from '../images/rezultat32.png'
import rezultat4 from '../images/rezultati4.png'
import { useInView } from 'react-intersection-observer';

const PlayIcon = () => <i className="ri-play-circle-line"></i>;
const ChevronIcon = ({ isOpen }) => <i className={`ri-arrow-down-s-line accordion-chevron ${isOpen ? 'open' : ''}`}></i>;

// 2. KREIRAMO NOVU KOMPONENTU ZA ANIMACIJU
const AnimateOnScroll = ({ children }) => {
  const { ref, inView } = useInView({
    triggerOnce: true, // Animacija će se pokrenuti samo jednom
    threshold: 0.1,    // Okida se kada je 10% elementa vidljivo
  });

  return (
    <div ref={ref} className={`fade-in-section ${inView ? 'is-visible' : ''}`}>
      {children}
    </div>
  );
};

const HeroSection = ({ navigate }) => (
    <section className="hero-section">
        <div className="container">
            <h1 className="hero-title">
                Postani <span className="highlight-text">Video Editor</span> i Unovči Svoju Kreativnost
            </h1>
            <p className="hero-subtitle">
                Jedan korak ti može potpuno promeniti <b className="bold-orange-glow">život</b> - odluka je na tebi.
            </p>
            <div className="hero-video-showcase" onClick={() => alert('Otvaranje videa...')}>
                <img src="https://andrijatest.b-cdn.net/slika-kursa-1752491711321-motionacademybanner.png" alt="Uvodni video" className="video-thumbnail" />
                <div className="video-overlay">
                    <PlayIcon />
                    <span>Pogledaj Uvodni Video</span>
                </div>
            </div>
            <div className="hero-cta-group">
                <p className="hero-subtitle2">
                    Pridruži se Akademiji koja će ti <b className='bold-orange-glow'>stvarno</b> promeniti život.
                </p>
                <button className="cta-button primary" onClick={() => navigate('/paket')}>Pridruži se!</button>
            </div>
        </div>
    </section>
);

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
                <h2 className="section-title">Šta Sve Dobijaš Unutar Akademije?</h2>
                <div className="features-grid">
                    {features.map((feature, index) => (
                        <div className="feature-card" key={index}>
                            <i className={feature.icon}></i>
                            <h3>{feature.title}</h3>
                            <p>{feature.text}</p>
                        </div>
                    ))}
                </div>
                <button className="cta-button secondary" onClick={() => navigate('/paket')}>Pridruži se</button>
            </div>
        </section>
    );
};

const TestimonialsSection = () => {
    const testimonials = [
        { name: 'Marko Nikolić', text: 'Kurs mi je otvorio oči! Odmah nakon završetka sam dobio prva dva klijenta. Preporuka!', image: 'https://i.pravatar.cc/150?u=marko' },
        { name: 'Jelena Jovanović', text: 'Najbolja investicija u moju karijeru. Mentor je sjajan, a lekcije su jasne i koncizne.', image: 'https://i.pravatar.cc/150?u=jelena' },
        { name: 'Stefan Stefanović', text: 'Mislio sam da znam osnove, ali ovaj kurs me je naučio profesionalnim tehnikama koje su mi donele posao.', image: 'https://i.pravatar.cc/150?u=stefan' },
        { name: 'Ana Anić', text: 'Podrška zajednice je neverovatna. Kad god zapnem, neko je tu da pomogne. Osećaj je sjajan!', image: 'https://i.pravatar.cc/150?u=ana' },
        { name: 'Nikola Nikolić', text: 'Od hobija do profesije za samo par meseci. Materijali su vrhunski, a praktični zadaci zlata vredni.', image: 'https://i.pravatar.cc/150?u=nikola' },
    ];

    const [currentIndex, setCurrentIndex] = useState(0);

    const scrollNext = () => {
        const cardsPerPage = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
        const maxIndex = testimonials.length - cardsPerPage;
        if (currentIndex < maxIndex) {
            setCurrentIndex(prevIndex => prevIndex + 1);
        }
    };

    const scrollPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prevIndex => prevIndex - 1);
        }
    };

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

const ResultsSection = ({ navigate }) => {
    const resultsImages = [
        { id: 1, src: rezultat5, alt: 'Primer rezultata 1' },
        { id: 2, src: rezultat2, alt: 'Primer rezultata 2' },
        { id: 3, src: rezultat3, alt: 'Primer rezultata 3' },
        { id: 4, src: rezultat4, alt: 'Primer rezultata 4' },
    ];

    return (
        <section className="section">
            <div className="container">
                <h2 className="section-title">Pogledaj Neke od Rezultata Video Editinga</h2>
                <p className="section-subtitle">
                    Ovo su samo jedni od <b className="bold-orange-glow">mnogih</b> rezultata video-editinga i mogućnosti koje on pruža.
                </p>
                <div className="results-grid">
                    {resultsImages.map(image => (
                        <div className="result-card" key={image.id}>
                            <img src={image.src} alt={image.alt} className="result-image" />
                        </div>
                    ))}
                </div>
                <button className="cta-button primary" onClick={() => navigate('/paket')}>Pridruži se Odmah</button>
            </div>
        </section>
    );
};

const FAQSection = ({ navigate }) => {
    const faqs = [
    { 
        q: <>Kakav je <b className="bold-orange-glow">život</b> video editora?</>, 
        a: <>Radiš <b className="bold-white">kad hoćeš, gde hoćeš</b>. Tvoj posao ti stane u ranac zajedno sa laptopom. Nema šefa nad glavom, nema kancelarije. Imaš <b className="bold-orange-glow">slobodu</b> da upravljaš svojim vremenom i pritom <b className="bold-white">zarađuješ više</b> nego neko ko je 8 sati zatvoren u kancelariji. Jedina razlika između mene i tebe je što sam ja već krenuo tim putem. Ti si sada na početku – ali to je <b className="bold-white">sve što ti treba</b>.</>
    },
    { 
        q: <>Da li mi je potrebno prethodno <b className="bold-orange-glow">iskustvo</b>?</>, 
        a: <><b className="bold-white">Ne</b>. Akademija je dizajnirana za <b className="bold-white">potpune početnike</b> i vodi vas <b className="bold-orange-glow">korak po korak</b> do uspešnog video-editora.</>
    },
    { 
        q: <>Da li se akademija <b className="bold-orange-glow">ažurira</b> vremenom?</>, 
        a: <><b className="bold-white">Da</b>, akademija se <b className="bold-orange-glow">redovno ažurira</b>! Stalno dodajemo <b className="bold-white">nove lekcije, savete i alate</b> kako bi akademija išla u korak s najnovijim trendovima u svetu editovanja.</>
    },
    { 
        q: <>Da li dobijam <b className="bold-orange-glow">podršku</b> tokom akademije?</>, 
        a: <><b className="bold-white">Da!</b> Imate <b className="bold-white">pristup privatnoj zajednici</b> gde možete postavljati pitanja <b className="bold-orange-glow">direktno mentoru</b> i drugim polaznicima.</>
    },
];
    const [openIndex, setOpenIndex] = useState(null);
    const toggleFAQ = index => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="section">
            <div className="container">
                <h2 className="section-title">Imate Pitanja? Imam Odgovore!</h2>
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
                <button className="cta-button primary" onClick={() => navigate('/paket')}>Kreni Sa Učenjem Odmah</button>
            </div>
        </section>
    );
};

const Footer = () => (
    <footer className="footer">
        <div className="container footer-content">
            <p>© {new Date().getFullYear()} MotionAcademy. Sva prava zadržana.</p>
           
            <div className="social-links">
                <a href="https://www.instagram.com/filip.motion" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i className="ri-instagram-line"></i></a>
                <a href="https://youtube.com/@filipmotion?si=LJx1cRMc10qlkxkq" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><i className="ri-youtube-line"></i></a>
            </div>
             {/* <p className='developedby'>Developed by: zecevic144@gmail.com</p> */}
        </div>
    </footer>
);

const Pocetna = () => {
    const navigate = useNavigate();
    return (
        <div className="pocetna-wrapper">
            <main className="pocetna-page">
                {/* 3. OBMOTAVAMO SVAKU SEKCIJU */}
                <AnimateOnScroll>
                    <HeroSection navigate={navigate} />
                </AnimateOnScroll>

                <AnimateOnScroll>
                    <FeaturesSection navigate={navigate} />
                </AnimateOnScroll>

                <AnimateOnScroll>
                    <TestimonialsSection />
                </AnimateOnScroll>
                
                <AnimateOnScroll>
                    <ResultsSection navigate={navigate} />
                </AnimateOnScroll>

                <AnimateOnScroll>
                    <FAQSection navigate={navigate} />
                </AnimateOnScroll>
            </main>
            {/* Footer ne mora da ima animaciju, ali možeš ga obmotati ako želiš */}
            <Footer />
        </div>
    );
};

export default Pocetna;
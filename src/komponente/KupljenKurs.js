import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../login/api";
import { useAuth } from "../login/auth";
import "./KupljenKurs.css";
import reactkurs from '../images/reactkurs.png';
import keyikonica from '../icons/key.png';
import moneybag from '../icons/money-bag.png';
import wave from '../icons/wave-sound.png';
import startup from '../icons/startup.png';
import crystal2 from '../icons/crystal2.png';
import potion from '../icons/potion.png';
import sword from '../icons/sword.png';
import krunica from '../icons/krunica.png';

// Niz sa klasama za ikonice.
const sectionIcons = [
    keyikonica,    // Ključ (za uvodne koncepte)
    potion,        // Napitak (za osnove)
    wave,          // Zvuk (za audio)
    crystal2,      // Kristal (za vizuelne efekte)
    moneybag,      // Novac (za monetizaciju)
    sword,         // Mač (za napredne tehnike)
    startup,       // Raketa (za eksportovanje)
    krunica,
    'ri-lightbulb-flash-line', // Sijalica (za ideje)
    'ri-tools-line'  // Alati (za tehničke veštine)
];

const KupljenKurs = () => {
    const [sviKupljeniKursevi, setSviKupljeniKursevi] = useState([]);
    const [selektovaniKursId, setSelektovaniKursId] = useState("");
    const [progresPoSekcijama, setProgresPoSekcijama] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingSekcija, setIsLoadingSekcija] = useState(false);

    const { user } = useAuth();
    const navigate = useNavigate();

    // Dohvata sve kupljene kurseve i automatski postavlja prvi kao selektovani
    useEffect(() => {
        const fetchKupljeneKurseve = async () => {
            if (user && user.id) {
                try {
                    setIsLoading(true);
                    const response = await api.get(`/api/kupovina/user/${user.id}`);
                    const kursevi = response.data;
                    setSviKupljeniKursevi(kursevi);

                    if (kursevi && kursevi.length > 0) {
                        setSelektovaniKursId(kursevi[0].id);
                    }

                } catch (error) {
                    console.error("Greška pri dohvatanju kupljenih kurseva:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        };
        fetchKupljeneKurseve();
    }, [user]);

    // Dohvata progres za automatski selektovani kurs
    useEffect(() => {
        const fetchProgresPoSekcijama = async () => {
            if (selektovaniKursId && user && user.id) {
                try {
                    setIsLoadingSekcija(true);
                    setProgresPoSekcijama([]); // Resetuj prethodne podatke
                    const response = await api.get(
                        `/api/kursevi/progres-sekcija/${selektovaniKursId}/korisnik/${user.id}`
                    );
                    setProgresPoSekcijama(response.data);
                } catch (error) {
                    console.error("Greška pri dohvatanju progresa po sekcijama:", error);
                } finally {
                    setIsLoadingSekcija(false);
                }
            }
        };
        fetchProgresPoSekcijama();
    }, [selektovaniKursId, user]); // Ovaj hook se pokreće kada se `selektovaniKursId` postavi


    if (isLoading) {
        return (
            <div className="kupljeni-kursevi-container1">
                <p>Učitavanje kursa...</p>
            </div>
        );
    }

    return (
        <div className="kupljeni-kursevi-container1">
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <filter id="water-effect">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.02 0.1"
                        numOctaves="2"
                        result="turbulence"
                    />
                    <feDisplacementMap
                        in="SourceGraphic"
                        in2="turbulence"
                        scale="15"
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />
                </filter>
            </svg>
            <h2 className="naslovkupljeni1">LEKCIJE</h2>

            {isLoadingSekcija && <p style={{ textAlign: 'center', marginTop: '2rem' }}>Učitavanje sekcija...</p>}

            {!isLoadingSekcija && progresPoSekcijama.length > 0 && (
                <div className="kurs-timeline">
                    {progresPoSekcijama.map((sekcija, index) => {
                        const iconClass = sectionIcons[index % sectionIcons.length];

                        return (
                            <div key={sekcija.sekcija_id} className="timeline-item">
                                <div className="timeline-dot"></div>
                                <div className="timeline-content kurs-card1">

                                    <img
                                        src={sekcija.thumbnail || reactkurs}
                                        alt={`Sekcija ${sekcija.naziv_sekcije}`}
                                        className="card-image"
                                    />

                                    <div className="card-body">
                                        <div className="card-header">
                                            <div className="timeline-icon-container">
                                                {typeof iconClass === 'string' && iconClass.startsWith('ri-') ? (
                                                    <i className={iconClass}></i>
                                                ) : (
                                                    <img src={iconClass} alt="ikona" className="timeline-png-icon" />
                                                )}
                                            </div>
                                            <h3>{sekcija.naziv_sekcije}</h3>
                                        </div>
                                        <div className="progres-container">
                                            <div className="progres-info">
                                                <h4>Progres</h4>
                                                <span className="procenti-broj">
                                                    {`${sekcija.progres || 0}%`}
                                                </span>
                                            </div>
                                            <div className="progres-bar">
                                                <div
                                                    className="progres-popunjeno"
                                                    style={{ width: `${sekcija.progres || 0}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="button-group1">
                                            <button
                                                onClick={() => navigate(`/kurs/${selektovaniKursId}?sekcija=${sekcija.sekcija_id}`)}
                                                className="kurs-link1"
                                            >
                                                {sekcija.progres > 0 ? 'NASTAVI UČENJE' : 'ZAPOČNI'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {!isLoading && !isLoadingSekcija && selektovaniKursId && progresPoSekcijama.length === 0 && (
                 <p style={{textAlign: 'center', marginTop: '2rem'}}>Ovaj kurs trenutno nema definisane sekcije.</p>
            )}

            {!isLoading && sviKupljeniKursevi.length === 0 && (
                 <p style={{textAlign: 'center', marginTop: '2rem'}}>Nemate kupljenih kurseva.</p>
            )}
        </div>
    );
};

export default KupljenKurs;
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../login/api";
import { useAuth } from "../login/auth";
import "./KupljenKurs.css";

const KupljenKurs = () => {
  // --- IZMENA: Restrukturiranje stanja (state) ---
  const [sviKupljeniKursevi, setSviKupljeniKursevi] = useState([]); // Čuva listu SVIH kurseva samo za dropdown
  const [selektovaniKursId, setSelektovaniKursId] = useState(""); // Čuva ID kursa koji je korisnik izabrao
  const [progresPoSekcijama, setProgresPoSekcijama] = useState([]); // Čuva podatke o sekcijama i progresu
  const [isLoading, setIsLoading] = useState(true); // Za inicijalno učitavanje liste kurseva
  const [isLoadingSekcija, setIsLoadingSekcija] = useState(false); // NOVO: Za učitavanje sekcija nakon odabira

  const { user } = useAuth();
  const navigate = useNavigate();

  // Proveravamo da li je korisnikova pretplata aktivna (logika ostaje ista)
  const imaAktivnuPretplatu =
    user &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at) > new Date();

  // --- IZMENA: Prvi useEffect - dobavlja samo listu kupljenih kurseva ---
  useEffect(() => {
    const fetchKupljeneKurseve = async () => {
      if (user && user.id) {
        try {
          setIsLoading(true);
          const response = await api.get(`/api/kupovina/user/${user.id}`);
          setSviKupljeniKursevi(response.data);
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

  // --- NOVO: Drugi useEffect - dobavlja progres po sekcijama KADA se odabere kurs ---
  useEffect(() => {
    const fetchProgresPoSekcijama = async () => {
      // Pokreće se samo ako su odabrani i kurs i korisnik
      if (selektovaniKursId && user && user.id) {
        try {
          setIsLoadingSekcija(true);
          setProgresPoSekcijama([]); // Resetuj prethodne rezultate
          // Pozivamo naš NOVI, moćni endpoint
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
  }, [selektovaniKursId, user]);


  const handleProduziPretplatu = async (kurs) => {
    // Ova logika ostaje ista, ali se više ne koristi u ovom prikazu
    // Možeš je ostaviti ako ti treba za nešto drugo
  };

  if (isLoading) {
    return (
      <div className="kupljeni-kursevi-container1">
        <p>Učitavanje kurseva...</p>
      </div>
    );
  }

 return (
    <div className="kupljeni-kursevi-container1">
        <h2 className="naslovkupljeni1">Moj Progres</h2>
        
        {!user && (
            <p>
                Molimo vas da se prijavite da biste videli svoje kupljene kurseve.
            </p>
        )}
        
        {user && sviKupljeniKursevi.length === 0 && !isLoading && (
            <p>Nema kupljenih kurseva.</p>
        )}

        {user && sviKupljeniKursevi.length > 0 && (
            <div className="kurs-selector-container">
                <label htmlFor="kurs-select">Izaberite kurs za pregled progresa:</label>
                <select 
                    id="kurs-select"
                    value={selektovaniKursId}
                    onChange={(e) => setSelektovaniKursId(e.target.value)}
                    className="kurs-select-dropdown"
                >
                    <option value="">-- Odaberi kurs --</option>
                    {sviKupljeniKursevi.map((kurs) => (
                        <option key={kurs.id} value={kurs.id}>
                            {kurs.naziv}
                        </option>
                    ))}
                </select>
            </div>
        )}

        {isLoadingSekcija && <p style={{textAlign: 'center', marginTop: '2rem'}}>Učitavanje sekcija...</p>}

        {!isLoadingSekcija && progresPoSekcijama.length > 0 && (
            <div className="kurs-timeline"> {/* IZMENA: Nova klasa za timeline kontejner */}
                {progresPoSekcijama.map((sekcija, index) => (
                    <div key={sekcija.sekcija_id} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content kurs-card1">
                            <div className="card-header">
                                <div className="timeline-step-number">{index + 1}</div>
                                <h3>{sekcija.naziv_sekcije}</h3>
                            </div>
                            
                            <div className="card-stats">
                                <div className="stat-item">
                                  <span className="stat-label">Ukupno Lekcija: </span>
                                  <span className="stat-value">{sekcija.ukupan_broj_lekcija}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-value">{sekcija.kompletiranih_lekcija}</span>
                                </div>
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
                                    onClick={() => navigate(`/kurs/${selektovaniKursId}`)}
                                    className="kurs-link1"
                                >
                                    Pristupi Kursu
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {!isLoadingSekcija && selektovaniKursId && progresPoSekcijama.length === 0 && (
            <p style={{textAlign: 'center', marginTop: '2rem'}}>Ovaj kurs nema definisane sekcije.</p>
        )}
    </div>
);
};

export default KupljenKurs;
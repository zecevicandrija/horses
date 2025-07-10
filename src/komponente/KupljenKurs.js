import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../login/auth";
import "./KupljenKurs.css";

const KupljenKurs = () => {
    const [kupljeniKursevi, setKupljeniKursevi] = useState([]);
    const [ratings, setRatings] = useState({});
    const [progress, setProgress] = useState({});
    const { user } = useAuth(); // Get user from auth hook

    // Fetch purchased courses for the logged-in user
    useEffect(() => {
        const fetchKupljeniKursevi = async () => {
            if (user && user.id) { // Check if user and user ID exist
                try {
                    const response = await axios.get(`https://horses-1.onrender.com/api/kupovina/user/${user.id}`);
                    if (response.status === 200) {
                        setKupljeniKursevi(response.data);
                    } else {
                        console.error('Failed to fetch purchased courses');
                    }
                } catch (error) {
                    console.error('Error fetching purchased courses:', error);
                }
            } else {
                console.warn('Korisnik nije ulogovan');
            }
        };

        fetchKupljeniKursevi();
    }, [user]);

    // Fetch ratings for each purchased course
    useEffect(() => {
        const fetchRatings = async () => {
            if (user && user.id) {
                const newRatings = {};
                for (const kurs of kupljeniKursevi) {
                    try {
                        const response = await axios.get(`https://horses-1.onrender.com/api/ratings/user/${user.id}/course/${kurs.id}`);
                        if (response.status === 200) {
                            newRatings[kurs.id] = response.data.ocena;
                        }
                    } catch (error) {
                        console.error(`Error fetching rating for course ${kurs.id}:`, error);
                    }
                }
                setRatings(newRatings);
            }
        };

        if (kupljeniKursevi.length > 0) {
            fetchRatings();
        }
    }, [kupljeniKursevi, user]);

    // Fetch lesson progress for each purchased course
    useEffect(() => {
        const fetchProgress = async () => {
            if (user && user.id) {
                const newProgress = {};
                for (const kurs of kupljeniKursevi) {
                    try {
                        const lessonsResponse = await axios.get(`https://horses-1.onrender.com/api/lekcije/course/${kurs.id}`);
                        const completedResponse = await axios.get(`https://horses-1.onrender.com/api/kompletirane_lekcije/user/${user.id}/course/${kurs.id}`);
                        const totalLessons = lessonsResponse.data.length;
                        const completedLessons = completedResponse.data.length;
                        newProgress[kurs.id] = (completedLessons / totalLessons) * 100;
                    } catch (error) {
                        console.error('Error fetching progress:', error);
                    }
                }
                setProgress(newProgress);
            }
        };

        if (kupljeniKursevi.length > 0) {
            fetchProgress();
        }
    }, [kupljeniKursevi, user]);

    return (
        <div className="kupljeni-kursevi-container">
            <h2 className="naslovkupljeni">Moji Kupljeni Kursevi</h2>
            {user ? (
                kupljeniKursevi.length > 0 ? (
                    <div className="kurs-list">
                        {kupljeniKursevi.map(kurs => (
                            <div key={kurs.id} className="kurs-card">
                                 {kurs.slika && (
                            <img src={kurs.slika} alt={kurs.naziv} className="kurs-slika" />
                        )}
                                <h3>{kurs.naziv}</h3>
                                <p>{kurs.opis}</p>
                                <p>Moja Ocena: <b>{ratings[kurs.id] ? `${ratings[kurs.id]}⭐` : 'Nema ocene'}</b></p>
                                <p>Progres: <b>{progress[kurs.id] ? `${Math.round(progress[kurs.id])}%` : 'Nema podataka'}</b></p>
                                <a href={`/kurs/${kurs.id}`} className="kurs-link">Pristupi kursu</a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>Nema kupljenih kurseva.</p>
                )
            ) : (
                <p>Molimo vas da se prijavite da biste videli svoje kupljene kurseve.</p>
            )}
        </div>
    );
};

export default KupljenKurs;

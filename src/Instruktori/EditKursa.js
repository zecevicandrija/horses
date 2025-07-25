import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../login/api';
import './EditKursa.css';

const EditKursa = () => {
    const { kursId } = useParams();
    const navigate = useNavigate();
    
    const [course, setCourse] = useState(null);
    const [lessons, setLessons] = useState([]);
    const [sekcije, setSekcije] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLesson, setEditingLesson] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', content: '', sekcija_id: '' });
    const [videoFile, setVideoFile] = useState(null);

    const [editingSekcijaId, setEditingSekcijaId] = useState(null);
    const [noviNazivSekcije, setNoviNazivSekcije] = useState('');
    const [originalOrder, setOriginalOrder] = useState([]);

    // NOVO: Stanje za dodavanje nove sekcije
    const [isAddingSekcija, setIsAddingSekcija] = useState(false);
    const [novaSekcijaNaziv, setNovaSekcijaNaziv] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [courseResponse, lessonsResponse, sekcijeResponse] = await Promise.all([
                api.get(`/api/kursevi/${kursId}`),
                api.get(`/api/lekcije/course/${kursId}`),
                api.get(`/api/lekcije/sections/${kursId}`)
            ]);
            setCourse(courseResponse.data);
            setLessons(lessonsResponse.data);
            setSekcije(sekcijeResponse.data);
            setOriginalOrder(sekcijeResponse.data.map(s => s.id));
        } catch (error) {
            console.error("Greška pri dohvatanju podataka:", error);
        } finally {
            setIsLoading(false);
        }
    }, [kursId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- LOGIKA ZA SEKCIJE ---

    // NOVO: Funkcija za dodavanje nove sekcije
    const handleAddNewSekcija = async (e) => {
        e.preventDefault();
        if (!novaSekcijaNaziv.trim()) {
            alert("Naziv sekcije ne može biti prazan.");
            return;
        }
        try {
            await api.post('/api/sekcije', {
                kurs_id: kursId,
                naziv: novaSekcijaNaziv
            });
            // Resetuj formu i osveži podatke
            setNovaSekcijaNaziv('');
            setIsAddingSekcija(false);
            fetchData();
        } catch (error) {
            console.error("Greška pri dodavanju nove sekcije:", error);
            alert("Neuspešno dodavanje sekcije.");
        }
    };
    
    const handleEditSekcijaClick = (sekcija) => {
        setEditingSekcijaId(sekcija.id);
        setNoviNazivSekcije(sekcija.naziv);
    };

    const handleSaveSekcija = async (sekcijaId) => {
        try {
            await api.put(`/api/sekcije/${sekcijaId}`, { naziv: noviNazivSekcije });
            setEditingSekcijaId(null);
            fetchData();
        } catch (error) {
            console.error("Greška pri izmeni naziva sekcije:", error);
            alert("Neuspešna izmena naziva.");
        }
    };

    const handleDeleteSekcija = async (sekcijaId) => {
        if (window.confirm('Da li ste sigurni? Brisanje sekcije će otkačiti sve lekcije iz nje.')) {
            try {
                await api.delete(`/api/sekcije/${sekcijaId}`);
                fetchData();
            } catch (error) {
                console.error("Greška pri brisanju sekcije:", error);
            }
        }
    };

    const handleMoveSekcija = (index, direction) => {
        const newSekcije = [...sekcije];
        const [movedItem] = newSekcije.splice(index, 1);
        newSekcije.splice(index + direction, 0, movedItem);
        setSekcije(newSekcije);
    };
    
    const handleSaveOrder = async () => {
        const orderedIds = sekcije.map(s => s.id);
        try {
            await api.put('/api/sekcije/order', { orderedIds });
            setOriginalOrder(orderedIds);
            alert('Redosled je sačuvan!');
        } catch (error) {
            console.error("Greška pri čuvanju redosleda:", error);
        }
    };

    const isOrderChanged = JSON.stringify(originalOrder) !== JSON.stringify(sekcije.map(s => s.id));

    // --- LOGIKA ZA LEKCIJE ---
    const handleDeleteLesson = async (lessonId) => {
        if (window.confirm('Da li ste sigurni da želite da obrišete ovu lekciju?')) {
            try {
                await api.delete(`/api/lekcije/${lessonId}`);
                setLessons(prevLessons => prevLessons.filter(l => l.id !== lessonId));
            } catch (error) {
                console.error("Greška pri brisanju lekcije:", error);
            }
        }
    };
    
    const handleOpenEditModal = (lesson) => {
        setEditingLesson(lesson);
        setEditForm({ 
            title: lesson.title, 
            content: lesson.content, 
            sekcija_id: lesson.sekcija_id || ''
        });
        setVideoFile(null);
        setIsEditModalOpen(true);
    };

    const handleEditFormChange = (e) => setEditForm({ ...editForm, [e.target.name]: e.target.value });
    const handleVideoChange = (e) => setVideoFile(e.target.files[0]);

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('title', editForm.title);
        formData.append('content', editForm.content);
        formData.append('course_id', editingLesson.course_id);
        formData.append('sekcija_id', editForm.sekcija_id);
        
        if (videoFile) {
            formData.append('video', videoFile);
        } else {
            formData.append('video_url', editingLesson.video_url || '');
        }

        try {
            await api.put(`/api/lekcije/${editingLesson.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setIsEditModalOpen(false);
            await fetchData();
        } catch (error) {
            console.error("Greška pri ažuriranju lekcije:", error);
        }
    };

    if (isLoading) return <div className="edit-kurs-container"><h2>Učitavanje...</h2></div>;

    return (
        <div className="edit-kurs-container">
            <button onClick={() => navigate('/instruktor')} className="back-button">Nazad na Tablu</button>
            <h1>Uređivanje Kursa: {course?.naziv}</h1>

            <div className="management-panel">
                <h2>Upravljanje Sekcijama</h2>
                {isOrderChanged && (
                    <button onClick={handleSaveOrder} className="save-order-btn">Sačuvaj novi redosled</button>
                )}
                <div className="sekcije-list">
                    {sekcije.map((sekcija, index) => (
                        <div key={sekcija.id} className="sekcija-card-edit">
                            {editingSekcijaId === sekcija.id ? (
                                <input 
                                    type="text"
                                    value={noviNazivSekcije}
                                    onChange={(e) => setNoviNazivSekcije(e.target.value)}
                                    className="sekcija-edit-input"
                                />
                            ) : (
                                <h4>{sekcija.redosled}. {sekcija.naziv}</h4>
                            )}
                            <div className="sekcija-actions">
                                {editingSekcijaId === sekcija.id ? (
                                    <>
                                        <button onClick={() => handleSaveSekcija(sekcija.id)} className="action-btn save-btn">Sačuvaj</button>
                                        <button onClick={() => setEditingSekcijaId(null)} className="action-btn cancel-btn">Odustani</button>
                                    </>
                                ) : (
                                    <button onClick={() => handleEditSekcijaClick(sekcija)} className="action-btn edit-btn">Izmeni Ime</button>
                                )}
                                <button onClick={() => handleDeleteSekcija(sekcija.id)} className="action-btn delete-btn">Obriši</button>
                                <div className="order-controls">
                                    <button onClick={() => handleMoveSekcija(index, -1)} disabled={index === 0} className="arrow-btn">▲</button>
                                    <button onClick={() => handleMoveSekcija(index, 1)} disabled={index === sekcije.length - 1} className="arrow-btn">▼</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* NOVO: Forma za dodavanje nove sekcije */}
                <div className="add-sekcija-panel">
                    {isAddingSekcija ? (
                        <form onSubmit={handleAddNewSekcija} className="add-sekcija-form">
                            <input
                                type="text"
                                placeholder="Unesite naziv nove sekcije"
                                value={novaSekcijaNaziv}
                                onChange={(e) => setNovaSekcijaNaziv(e.target.value)}
                                className="sekcija-add-input"
                                autoFocus
                            />
                            <button type="submit" className="action-btn save-btn">Dodaj</button>
                            <button type="button" onClick={() => setIsAddingSekcija(false)} className="action-btn cancel-btn">Odustani</button>
                        </form>
                    ) : (
                        <button onClick={() => setIsAddingSekcija(true)} className="add-sekcija-btn">
                            + Dodaj Novu Sekciju
                        </button>
                    )}
                </div>
            </div>

            <hr className="separator"/>

            <h2>Uređivanje Lekcija</h2>
            <div className="lessons-grid">
                {lessons.map(lesson => (
                    <div className="lesson-card-edit" key={lesson.id}>
                        <h4>{lesson.title}</h4>
                        <p>Sekcija: {sekcije.find(s => s.id === lesson.sekcija_id)?.naziv || 'Nije dodeljena'}</p>
                        <p>{lesson.content.substring(0, 100)}...</p>
                        <div className="lesson-actions">
                            <button onClick={() => handleOpenEditModal(lesson)} className="edit-btn">Izmeni</button>
                            <button onClick={() => handleDeleteLesson(lesson.id)} className="delete-btn">Obriši</button>
                        </div>
                    </div>
                ))}
            </div>

            {isEditModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button className="close-modal-button" onClick={() => setIsEditModalOpen(false)}>&times;</button>
                        <h2>Izmeni Lekciju: {editingLesson?.title}</h2>
                        <form onSubmit={handleEditSubmit} className="modal-form">
                            <label>Naslov: <input type="text" name="title" value={editForm.title} onChange={handleEditFormChange} required /></label>
                            <label>Sadržaj: <textarea name="content" value={editForm.content} onChange={handleEditFormChange} required></textarea></label>
                            <label>
                                Sekcija:
                                <select name="sekcija_id" value={editForm.sekcija_id} onChange={handleEditFormChange}>
                                    <option value="">-- Nije dodeljena --</option>
                                    {sekcije.map(s => (
                                        <option key={s.id} value={s.id}>{s.naziv}</option>
                                    ))}
                                </select>
                            </label>
                            <label>Zameni Video (opciono): <input type="file" accept="video/*" onChange={handleVideoChange} /></label>
                            <button type="submit" className="save-button">Sačuvaj Izmene</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditKursa;
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../login/auth';
import { useNavigate } from 'react-router-dom';
import api from '../login/api';
import './Instruktor.css';
import Zarada from './Zarada';
import Popust from '../Kupovina/Popust';

const Instruktor = () => {
    const [kursevi, setKursevi] = useState([]);
    const [isEditCourseModalOpen, setIsEditCourseModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
    const [editingCourse, setEditingCourse] = useState(null);
    const [courseToDelete, setCourseToDelete] = useState(null);
    
    const [editCourseForm, setEditCourseForm] = useState({ naziv: '', opis: '', cena: '' });
    const [courseImageFile, setCourseImageFile] = useState(null);

    const { user } = useAuth();
    const instructorId = user ? user.id : null;
    const navigate = useNavigate();

    const fetchKursevi = useCallback(async () => {
        if (instructorId) {
            try {
                const response = await api.get(`/api/kursevi/instruktor/${instructorId}`);
                setKursevi(response.data);
            } catch (error) {
                console.error('Greška pri dohvatanju kurseva:', error);
            }
        }
    }, [instructorId]);

    useEffect(() => {
        fetchKursevi();
    }, [fetchKursevi]);

    // --- Logika za Izmenu Kursa ---
    const openEditCourseModal = (course) => {
        setEditingCourse(course);
        setEditCourseForm({ naziv: course.naziv, opis: course.opis, cena: course.cena });
        setCourseImageFile(null); // Resetuj fajl
        setIsEditCourseModalOpen(true);
    };

    const handleEditCourseChange = (e) => setEditCourseForm({ ...editCourseForm, [e.target.name]: e.target.value });
    const handleCourseImageChange = (e) => setCourseImageFile(e.target.files[0]);

    const handleEditCourseSubmit = async (e) => {
        e.preventDefault();
        if (!editingCourse) return;

        const formData = new FormData();
        formData.append('naziv', editCourseForm.naziv);
        formData.append('opis', editCourseForm.opis);
        formData.append('cena', editCourseForm.cena);
        formData.append('instruktor_id', instructorId);
        if (courseImageFile) {
            formData.append('slika', courseImageFile);
        }

        try {
            await api.put(`/api/kursevi/${editingCourse.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await fetchKursevi(); // Osveži listu da prikaže izmene
            setIsEditCourseModalOpen(false);
        } catch (error) {
            console.error('Greška pri ažuriranju kursa:', error);
        }
    };

    // --- Logika za Brisanje Kursa ---
    const openDeleteModal = (course) => {
        setCourseToDelete(course);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteCourse = async () => {
        if (!courseToDelete) return;

        try {
            await api.delete(`/api/kursevi/${courseToDelete.id}`);
            setKursevi(kursevi.filter(kurs => kurs.id !== courseToDelete.id));
        } catch (error) {
            console.error('Greška pri brisanju kursa:', error);
        } finally {
            setIsDeleteModalOpen(false);
            setCourseToDelete(null);
        }
    };

    // --- Navigacija ---
    const viewStudents = (kursId) => navigate(`/studenti/${kursId}`);
    const viewLessons = (courseId) => navigate(`/edit-kurs/${courseId}`);
    const viewStatistics = (kursId) => navigate(`/statistika/${kursId}`);


    return (
        <div className="instruktor-dashboard">
            <header className="dashboard-header">
                <h1>Instruktorska Tabla</h1>
                <p>Dobrodošli, {user?.ime}! Upravljajte svojim kursevima i pratite zaradu.</p>
            </header>
            
            <div className="dashboard-main-content">
                <div className="dashboard-kursevi-section">
                    <h2 className="section-title">Moji Kursevi</h2>
                    <div className="kurs-lista">
                        {kursevi.length > 0 ? kursevi.map(kurs => (
                            <div className="kurs-card-admin" key={kurs.id}>
                                <img src={kurs.slika} alt={kurs.naziv} className="kurs-slika-admin" />
                                <div className="kurs-info-admin">
                                    <h3>{kurs.naziv}</h3>
                                    <p className="kurs-cena-admin">{kurs.cena} €</p>
                                </div>
                                <div className="kurs-actions-admin">
                                    <button onClick={() => openEditCourseModal(kurs)} title="Izmeni Kurs"><i className="ri-edit-line"></i></button>
                                    <button onClick={() => viewLessons(kurs.id)} title="Uredi Lekcije"><i className="ri-list-check"></i></button>
                                    <button onClick={() => viewStudents(kurs.id)} title="Pregled Studenata"><i className="ri-group-line"></i></button>
                                    <button onClick={() => viewStatistics(kurs.id)} title="Statistika Kursa"><i className="ri-bar-chart-line"></i></button>
                                    <button onClick={() => openDeleteModal(kurs)} className="delete-button-admin" title="Obriši Kurs"><i className="ri-delete-bin-line"></i></button>
                                </div>
                            </div>
                        )) : <p>Trenutno nemate kreiranih kurseva.</p>}
                    </div>
                </div>

                <div className="dashboard-side-content">
                    <div className="dashboard-widget"><Zarada kursevi={kursevi} /></div>
                    <div className="dashboard-widget"><Popust /></div>
                </div>
            </div>


            {/* Edit Course Modal */}
            {isEditCourseModalOpen && editingCourse && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button className="close-modal-button" onClick={() => setIsEditCourseModalOpen(false)}>&times;</button>
                        <h2>Izmeni Kurs</h2>
                        <form onSubmit={handleEditCourseSubmit} className="modal-form">
                            <label>Naziv: <input type="text" name="naziv" value={editCourseForm.naziv} onChange={handleEditCourseChange} required /></label>
                            <label>Opis: <textarea name="opis" value={editCourseForm.opis} onChange={handleEditCourseChange} required></textarea></label>
                            <label>Cena: <input type="number" name="cena" value={editCourseForm.cena} onChange={handleEditCourseChange} required /></label>
                            <label>Nova Slika (opciono): <input type="file" accept="image/*" onChange={handleCourseImageChange} /></label>
                            <button type="submit" className="save-button">Sačuvaj Izmene</button>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && courseToDelete && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Potvrda Brisanja</h2>
                        <p>Da li ste sigurni da želite trajno da obrišete kurs: <strong>{courseToDelete.naziv}</strong>?</p>
                        <div className="modal-actions">
                            <button onClick={() => setIsDeleteModalOpen(false)} className="cancel-delete-btn">Odustani</button>
                            <button onClick={confirmDeleteCourse} className="confirm-delete-btn">Obriši</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Instruktor;
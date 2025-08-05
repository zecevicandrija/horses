import React, { useEffect, useState } from 'react';
import api from '../login/api'; // IZMENA: Koristimo centralni API klijent umesto axios-a
import { useAuth } from '../login/auth';
import './Lekcije.css';

const Lekcije = () => {
    const [lekcije, setLekcije] = useState([]);
    const [courses, setCourses] = useState([]);
    const [sections, setSections] = useState([]);
    
    // IZMENA: Umesto 'section' sada imamo 'sekcija_id'
    const [newLekcija, setNewLekcija] = useState({ 
        course_id: '', 
        title: '', 
        content: '', 
        sekcija_id: '', // Ključna promena ovde
        assignment: '' 
    });

    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        // Dobavljanje kurseva koje je instruktor kreirao
        const fetchCourses = async () => {
            if (!user || !user.id) return;
            try {
                // IZMENA: Koristimo 'api'
                const response = await api.get(`/api/kursevi/instruktor/${user.id}`);
                setCourses(response.data);
            } catch (error) {
                console.error('Error fetching courses:', error);
            }
        };

        fetchCourses();
    }, [user]);

    // Funkcija za dobavljanje sekcija na osnovu izabranog kursa
    const fetchSections = async (courseId) => {
        if (!courseId) {
            setSections([]); // Resetuj sekcije ako kurs nije izabran
            return;
        }
        try {
            // IZMENA: Koristimo 'api'. Endpoint je sada ispravan i vraća niz objekata.
            const response = await api.get(`/api/lekcije/sections/${courseId}`);
            setSections(response.data);
        } catch (error) {
            console.error('Error fetching sections:', error);
            setSections([]);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewLekcija({ ...newLekcija, [name]: value });

        // Ako se menja kurs, dobavi nove sekcije
        if (name === 'course_id') {
            // Resetuj izabranu sekciju i dobavi nove
            setNewLekcija(prev => ({ ...prev, course_id: value, sekcija_id: '' }));
            fetchSections(value);
        }
    };

    const handleVideoChange = (e) => {
        setVideo(e.target.files[0]);
    };

    const handleAddLekcija = async (e) => {
        e.preventDefault();
        
        // Validacija
        if (!newLekcija.course_id || !newLekcija.sekcija_id || !newLekcija.title || !newLekcija.content || !video) {
            alert('Sva polja i video su obavezni, uključujući i odabir sekcije.');
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('course_id', newLekcija.course_id);
            formData.append('title', newLekcija.title);
            formData.append('content', newLekcija.content);
            // IZMENA: Šaljemo 'sekcija_id' umesto 'section'
            formData.append('sekcija_id', newLekcija.sekcija_id);
            formData.append('assignment', newLekcija.assignment);
            formData.append('video', video);

            // IZMENA: Koristimo 'api'
            await api.post('/api/lekcije', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            alert('Lekcija uspešno dodata!');
            // Resetovanje forme
            setNewLekcija({ course_id: '', title: '', content: '', sekcija_id: '', assignment: '' });
            setVideo(null);
            setSections([]);
            // Opciono: osveži listu svih lekcija ako je prikazuješ negde
            // const lekcijeResponse = await api.get('/api/lekcije');
            // setLekcije(lekcijeResponse.data);

        } catch (error) {
            console.error('Error adding lesson:', error);
            alert(`Greška pri dodavanju lekcije: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lekcije-container">
            <h3 className='lekcijenaslov1'>Napravite Lekcije</h3>

            <form onSubmit={handleAddLekcija} className="add-lekcija-form">
                <div>
                    <label htmlFor="course_id">Izaberite kurs:</label>
                    <select
                        id="course_id"
                        name="course_id"
                        value={newLekcija.course_id}
                        onChange={handleInputChange}
                        required
                    >
                        <option value="">-- Izaberite kurs --</option>
                        {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                                {course.naziv}
                            </option>
                        ))}
                    </select>
                </div>

                {/* ISPRAVLJENO: Dropdown za sekcije */}
                <div>
                    <label htmlFor="sekcija_id">Sekcija:</label>
                    <select
                        id="sekcija_id"
                        name="sekcija_id" // ISPRAVLJENO: name atribut
                        value={newLekcija.sekcija_id} // ISPRAVLJENO: state vrednost
                        onChange={handleInputChange}
                        required
                        disabled={!newLekcija.course_id || sections.length === 0} // Onemogući ako nema kursa ili sekcija
                    >
                        <option value="">-- Izaberite sekciju --</option>
                        {/* ISPRAVLJENO: Mapiranje niza objekata */}
                        {sections.map((sekcija) => (
                            <option key={sekcija.id} value={sekcija.id}>
                                {sekcija.naziv}
                            </option>
                        ))}
                    </select>
                    {newLekcija.course_id && sections.length === 0 && <small>Ovaj kurs nema definisane sekcije. Dodajte ih prvo u admin panelu.</small>}
                </div>

                <div>
                    <label htmlFor="title">Naslov lekcije:</label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={newLekcija.title}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="content">Sadržaj lekcije:</label>
                    <textarea
                        id="content"
                        name="content"
                        value={newLekcija.content}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                
                <div>
                    <label htmlFor="video">Izaberite Video:</label>
                    <input
                        type="file"
                        id="video"
                        name="video"
                        accept="video/*"
                        onChange={handleVideoChange}
                        required
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? 'Dodavanje...' : 'Dodaj Lekciju'}
                </button>
                {loading && <p>Dodavanje lekcije... Molimo sačekajte.</p>}
            </form>
        </div>
    );
};

export default Lekcije;
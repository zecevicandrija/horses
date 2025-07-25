// src/api.js
import axios from 'axios';

// Kreiramo novu instancu Axios-a sa osnovnom konfiguracijom
const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
});

// Ovo je "interceptor" (presretač) - funkcija koja se izvršava PRE svakog zahteva
api.interceptors.request.use(
    (config) => {
        // Uzimamo token iz localStorage
        const token = localStorage.getItem('token');
        // Ako token postoji, dodajemo ga u zaglavlje (headers)
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
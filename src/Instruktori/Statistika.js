import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import { subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import api from '../login/api'
import 'react-datepicker/dist/react-datepicker.css';
import './Statistika.css';

const Statistika = () => {
    const { kursId } = useParams();
    const navigate = useNavigate();
    
    const [stats, setStats] = useState({ totalSales: 0, totalRevenue: 0, chartData: [] });
    const [courseName, setCourseName] = useState('');
    const [dateRange, setDateRange] = useState({
        startDate: subDays(new Date(), 30),
        endDate: new Date()
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchStatistics = useCallback(async () => {
        setIsLoading(true);
        const formattedStartDate = format(dateRange.startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(dateRange.endDate, 'yyyy-MM-dd');

        try {
            const [statsRes, courseRes] = await Promise.all([
                api.get(`/api/kupovina/statistika/${kursId}?startDate=${formattedStartDate}&endDate=${formattedEndDate}`),
                api.get(`/api/kursevi/${kursId}`)
            ]);
            setStats(statsRes.data);
            setCourseName(courseRes.data.naziv);
        } catch (error) {
            console.error("Greška pri dohvatanju statistike:", error);
        } finally {
            setIsLoading(false);
        }
    }, [kursId, dateRange]);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics]);
    
    const handlePresetRange = (period) => {
        const end = new Date();
        let start;
        switch (period) {
            case '7d': start = subDays(end, 7); break;
            case '30d': start = subDays(end, 30); break;
            case '6m': start = startOfMonth(subDays(end, 180)); break;
            case '1y': start = startOfYear(new Date()); break;
            default: start = subDays(end, 30);
        }
        setDateRange({ startDate: start, endDate: end });
    };

    const chartData = {
        labels: stats.chartData.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [{
            label: 'Dnevna Zarada (€)',
            data: stats.chartData.map(d => d.revenue),
            borderColor: '#ffa500',
            backgroundColor: 'rgba(255, 165, 0, 0.2)',
            fill: true,
            tension: 0.4
        }]
    };
    
    // Ostatak koda za Chart.js opcije...
    const chartOptions = { /*... (isti kao u Zarada.js) ...*/ };

    return (
        <div className="statistika-container">
            <button onClick={() => navigate('/instruktor')} className="back-button-statistika">← Nazad</button>
            <header className="statistika-header">
                <h1>Statistika za kurs: <span>{courseName}</span></h1>
            </header>

            <div className="filter-bar">
                <div className="date-picker-group">
                    <DatePicker selected={dateRange.startDate} onChange={date => setDateRange({ ...dateRange, startDate: date })} className="date-picker" />
                    <span>do</span>
                    <DatePicker selected={dateRange.endDate} onChange={date => setDateRange({ ...dateRange, endDate: date })} className="date-picker" />
                </div>
                <div className="preset-buttons">
                    <button onClick={() => handlePresetRange('7d')}>7 Dana</button>
                    <button onClick={() => handlePresetRange('30d')}>30 Dana</button>
                    <button onClick={() => handlePresetRange('6m')}>6 Meseci</button>
                    <button onClick={() => handlePresetRange('1y')}>Ova Godina</button>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <h4>Ukupna Zarada</h4>
                    <p>{stats.totalRevenue.toFixed(2)} €</p>
                </div>
                <div className="stat-card">
                    <h4>Ukupno Prodaja</h4>
                    <p>{stats.totalSales}</p>
                </div>
            </div>

            <div className="chart-wrapper">
                <h3>Trend Prodaje</h3>
                {isLoading ? <p>Učitavanje grafikona...</p> : <Line data={chartData} options={chartOptions} />}
            </div>
        </div>
    );
};

export default Statistika;
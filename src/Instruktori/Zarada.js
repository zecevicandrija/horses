import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import api from "../login/api"; // Koristimo naš centralizovani API klijent
import "./Zarada.css";

// Registrujemo sve potrebne delove za Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Zarada = () => {
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchZaradaData = async () => {
      try {
        setIsLoading(true);
        // Pozivamo endpoint koji nam vraća zaradu grupisanu po danima
        const response = await api.get("/api/kupovina/zarada-po-danu");
        const data = response.data;

        if (data && data.length > 0) {
          // Pripremamo podatke za grafikon
          const labels = data.map((item) =>
            new Date(item.dan).toLocaleDateString()
          );
          const earningsData = data.map((item) => item.dnevna_zarada);

          // Izračunavamo ukupnu zaradu
          // Novi kod sa Number()
          const total = earningsData.reduce(
            (acc, current) => acc + Number(current),
            0
          );
          setTotalEarnings(total);

          // Postavljamo podatke za grafikon
          setChartData({
            labels,
            datasets: [
              {
                label: "Zarada po danu (€)",
                data: earningsData,
                borderColor: "#ffa500",
                backgroundColor: "rgba(255, 165, 0, 0.2)",
                fill: true,
                tension: 0.4,
                pointBackgroundColor: "#ffa500",
                pointBorderColor: "#fff",
                pointHoverRadius: 7,
              },
            ],
          });
        }
      } catch (error) {
        console.error("Greška pri dohvatanju podataka o zaradi:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchZaradaData();
  }, []);

  // Opcije za stilizovanje grafikona da se uklopi u tamnu temu
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#ccc",
          font: { size: 14 },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#ccc" },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
      y: {
        ticks: { color: "#ccc" },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
    },
  };

  return (
    <div className="zarada-widget-container">
      <h3 className="zarada-title">Pregled Zarade</h3>
      <div className="zarada-summary">
        <p>Ukupna Zabeležena Zarada:</p>
        <h4 className="zarada-total">{totalEarnings.toFixed(2)} €</h4>
      </div>
      <div className="chart-container">
        {isLoading ? (
          <p>Učitavanje grafikona...</p>
        ) : chartData.labels.length > 0 ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <p>Nema podataka za prikaz.</p>
        )}
      </div>
    </div>
  );
};

export default Zarada;

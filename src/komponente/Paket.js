import React from "react";
import "./Paket.css";
import filipImg from "../images/filip2.png";
import banner from '../images/motionakademijabanner.jpg';
import animatedbanner from '../images/0731banrer.gif';
import { useNavigate } from 'react-router-dom';

// tiny helper: renders one <span class="particle7"> per sparkle
const Particles = ({ count = 12 }) =>
  [...Array(count)].map((_, i) => (
    <span
      key={i}
      className="particle7"
      style={{
        "--rx": Math.random() * 360,
        "--ry": Math.random() * 360,
        "--delay": Math.random() * 2,
      }}
    />
  ));

const Paket = () => {
    const navigate = useNavigate();
    const RedirektujHandler = () => {
        navigate('/kurs/1');
    }
  const plans = [
    {
      title: "STANDARD",
      price: "49€",
      period: "/ 1 mesec",
      imagee: banner,
      icon: "🚀",
      list: [
        "Kompletan kurs za Premiere Pro",
        "Kompletan kurs za After Effects",
        "Pristup privatnoj zajednici",
        "Live pozivi",
        "Ista cena zauvek"
      ]
    },
    {
      title: "PRO",
      price: "140€",
      period: "/ 3 meseca",
      imagee: animatedbanner,
      icon: "⚡",
      list: [
        "Kompletan kurs za Premiere Pro",
        "Kompletan kurs za After Effects",
        "Pristup privatnoj zajednici",
        "Live pozivi",
        "Ista cena zauvek"
      ]
    }
  ];

  return (
    <section className="container7">
      <h2 className="naslov7">Odaberi paket</h2>

      <div className="cards7">
        {plans.map((p, i) => (
          <div className="card7" key={i} data-tilt>
            <div className="badge7">
              {p.icon} {p.title}
            </div>

            <div className="imgWrap7">
              <img src={p.imagee} alt={p.title} className="cardImg7" />
              <div className="imgGlow7" />
            </div>

            <Particles />

            <div className="price7">
              <span className="amount7">{p.price}</span>
              <span className="period7">{p.period}</span>
            </div>

            <ul className="features7">
              {p.list.map((f, j) => (
                <li key={j} className="feature7">
                  <span className="check7">✓</span> {f}
                </li>
              ))}
            </ul>

            <button className="btn7" onClick={RedirektujHandler}>
              PRIDRUŽI SE
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Paket;
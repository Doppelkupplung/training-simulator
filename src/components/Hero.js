import React from 'react';
import './Hero.css';

function Hero() {
  return (
    <div className="hero">
      <div className="hero-content">
        <h1>Customer Service Training Simulator</h1>
        <p>Practice and perfect your customer service skills with AI-powered customer interactions</p>
        <div className="hero-buttons">
          <button className="cta-button primary">Start Training</button>
          <button className="cta-button secondary">Create Persona</button>
        </div>
      </div>
    </div>
  );
}

export default Hero; 
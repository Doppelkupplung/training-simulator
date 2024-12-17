import React from 'react';
import './Navbar.css';

function Navbar() {
  console.log('Navbar component rendering');
  
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1>CS Training Simulator</h1>
      </div>
      <div className="navbar-links">
        <a href="#personas">Select Persona</a>
        <a href="#scenarios">Scenarios</a>
        <a href="#history">Chat History</a>
        <a href="#settings">Settings</a>
      </div>
    </nav>
  );
}

export default Navbar; 
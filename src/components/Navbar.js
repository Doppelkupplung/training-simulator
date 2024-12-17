import React from 'react';
import './Navbar.css';

function Navbar() {
  console.log('Navbar component rendering');
  
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1>Chat Simulator</h1>
      </div>
      <div className="navbar-links">
        <a href="#chat">Chat</a>
        <a href="#personas">Persona Builder</a>
        <a href="#scenarios">Scenarios</a>
        <a href="#history">Chat History</a>
        <a href="#settings">Settings</a>
      </div>
    </nav>
  );
}

export default Navbar; 
import React from 'react';
import './Navbar.css';

function Navbar() {
  return (
    <>
      <div className="navbar-trigger" />
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>Chat Simulator</h1>
        </div>
        <div className="navbar-links">
          <a href="#chat">Chat</a>
          <a href="#personas">Persona Builder</a>
        </div>
      </nav>
    </>
  );
}

export default Navbar; 
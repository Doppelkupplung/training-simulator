import React from 'react';
import './Navbar.css';

function Navbar() {
  return (
    <>
      <div className="navbar-trigger" />
      <nav className="navbar">
        <div className="navbar-brand">
        </div>
        <div className="navbar-links">
          <a href="#chat">Chat</a>
          <a href="#personas">Persona Builder</a>
          <a href="#thread">Thread Builder</a>
        </div>
      </nav>
    </>
  );
}

export default Navbar;

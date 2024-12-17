import React, { useState, useEffect } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import Chat from './components/Chat';
import PersonaBuilder from './components/PersonaBuilder';
import ErrorBoundary from './components/ErrorBoundary';
import dbService from './services/database';

function App() {
  const [currentPage, setCurrentPage] = useState('chat');
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load personas from database
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const loadedPersonas = await dbService.getAllPersonas();
        setPersonas(loadedPersonas);
      } catch (err) {
        console.error('Error loading personas:', err);
        setError('Failed to load personas');
      } finally {
        setLoading(false);
      }
    };

    loadPersonas();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || 'chat';
      setCurrentPage(hash);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAddPersona = async (newPersona) => {
    try {
      const createdPersona = await dbService.createPersona(newPersona);
      setPersonas(prev => [createdPersona, ...prev]);
    } catch (err) {
      console.error('Error creating persona:', err);
      alert('Failed to create persona');
    }
  };

  const handleEditPersona = async (editedPersona) => {
    try {
      const success = await dbService.updatePersona(editedPersona);
      if (success) {
        setPersonas(prev => prev.map(persona => 
          persona.id === editedPersona.id ? editedPersona : persona
        ));
      } else {
        throw new Error('Failed to update persona');
      }
    } catch (err) {
      console.error('Error updating persona:', err);
      alert('Failed to update persona');
    }
  };

  const handleDeletePersona = async (personaId) => {
    try {
      const success = await dbService.deletePersona(personaId);
      if (success) {
        setPersonas(prev => prev.filter(persona => persona.id !== personaId));
      } else {
        throw new Error('Failed to delete persona');
      }
    } catch (err) {
      console.error('Error deleting persona:', err);
      alert('Failed to delete persona');
    }
  };

  const renderContent = () => {
    if (loading) {
      return <div className="loading">Loading personas...</div>;
    }

    if (error) {
      return <div className="error">{error}</div>;
    }

    switch (currentPage) {
      case 'personas':
        return (
          <PersonaBuilder 
            personas={personas} 
            onAddPersona={handleAddPersona}
            onEditPersona={handleEditPersona}
            onDeletePersona={handleDeletePersona}
          />
        );
      case 'chat':
        return <Chat />;
      case 'scenarios':
        return <div>Scenarios Page</div>;
      case 'history':
        return <div>Chat History Page</div>;
      case 'settings':
        return <div>Settings Page</div>;
      default:
        return <Chat />;
    }
  };
  
  return (
    <ErrorBoundary>
      <div className="App">
        <Navbar />
        {renderContent()}
      </div>
    </ErrorBoundary>
  );
}

export default App;

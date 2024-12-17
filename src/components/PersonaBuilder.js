import React, { useState } from 'react';
import Modal from './Modal';
import './PersonaBuilder.css';

function PersonaBuilder({ personas, onAddPersona, onEditPersona, onDeletePersona }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    personality: ''
  });

  const handleAddPersona = () => {
    setEditingPersona(null);
    setFormData({ name: '', age: '', personality: '' });
    setIsModalOpen(true);
  };

  const handleEditPersona = (persona) => {
    setEditingPersona(persona);
    setFormData({
      name: persona.name,
      age: persona.age,
      personality: persona.personality
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ name: '', age: '', personality: '' });
    setEditingPersona(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const personaData = {
      ...formData,
      age: parseInt(formData.age, 10)
    };

    if (editingPersona) {
      onEditPersona({ ...personaData, id: editingPersona.id });
    } else {
      onAddPersona(personaData);
    }
    handleCloseModal();
  };

  const handleDelete = (persona) => {
    if (window.confirm(`Are you sure you want to delete ${persona.name}?`)) {
      onDeletePersona(persona.id);
    }
  };

  return (
    <div className="persona-builder">
      <div className="persona-header">
        <h2>Persona Builder</h2>
        <button className="add-persona-button" onClick={handleAddPersona}>
          Add Persona
        </button>
      </div>
      <div className="personas-list">
        {personas.length === 0 ? (
          <div className="empty-state">
            <p>No personas created yet. Click "Add Persona" to get started.</p>
          </div>
        ) : (
          personas.map((persona) => (
            <div key={persona.id} className="persona-card">
              <div className="persona-content">
                <h3>{persona.name}</h3>
                <p>Age: {persona.age}</p>
                <p>Personality: {persona.personality}</p>
              </div>
              <div className="persona-actions">
                <button 
                  className="edit-button"
                  onClick={() => handleEditPersona(persona)}
                >
                  Edit
                </button>
                <button 
                  className="delete-button"
                  onClick={() => handleDelete(persona)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingPersona ? "Edit Persona" : "Add New Persona"}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="age">Age</label>
            <input
              type="number"
              id="age"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              required
              min="0"
            />
          </div>
          <div className="form-group">
            <label htmlFor="personality">Personality</label>
            <textarea
              id="personality"
              name="personality"
              value={formData.personality}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="cancel" onClick={handleCloseModal}>
              Cancel
            </button>
            <button type="submit" className="submit">
              {editingPersona ? "Save Changes" : "Create Persona"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PersonaBuilder; 
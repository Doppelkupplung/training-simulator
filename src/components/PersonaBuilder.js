import React, { useState } from 'react';
import Modal from './Modal';
import './PersonaBuilder.css';

function PersonaBuilder({ personas, onAddPersona, onEditPersona, onDeletePersona }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    karma: '',
    personality: '',
    interests: '',
    writingStyle: ''
  });

  const handleAddPersona = () => {
    setEditingPersona(null);
    setFormData({
      username: '',
      karma: '',
      personality: '',
      interests: '',
      writingStyle: ''
    });
    setIsModalOpen(true);
  };

  const handleEditPersona = (persona) => {
    setEditingPersona(persona);
    setFormData({
      username: persona.username,
      karma: persona.karma,
      personality: persona.personality,
      interests: persona.interests,
      writingStyle: persona.writingStyle
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      username: '',
      karma: '',
      personality: '',
      interests: '',
      writingStyle: ''
    });
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
      karma: parseInt(formData.karma, 10)
    };

    if (editingPersona) {
      onEditPersona({ ...personaData, id: editingPersona.id });
    } else {
      onAddPersona(personaData);
    }
    handleCloseModal();
  };

  const handleDelete = (persona) => {
    if (window.confirm(`Are you sure you want to delete u/${persona.username}?`)) {
      onDeletePersona(persona.id);
    }
  };

  return (
    <div className="persona-builder">
      <div className="persona-header">
        <h2>Reddit User Simulator</h2>
        <button className="add-persona-button" onClick={handleAddPersona}>
          Add Reddit User
        </button>
      </div>
      <div className="personas-list">
        {personas.length === 0 ? (
          <div className="empty-state">
            <p>No Reddit users created yet. Click "Add Reddit User" to get started.</p>
          </div>
        ) : (
          personas.map((persona) => (
            <div key={persona.id} className="persona-card">
              <div className="persona-content">
                <h3>u/{persona.username}</h3>
                <p className="karma">Karma: {persona.karma}</p>
                <p><strong>Personality:</strong> {persona.personality}</p>
                <p><strong>Interests:</strong> {persona.interests}</p>
                <p><strong>Writing Style:</strong> {persona.writingStyle}</p>
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
        title={editingPersona ? "Edit Reddit User" : "Add New Reddit User"}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="username-input">
              <span className="username-prefix">u/</span>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                placeholder="username"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="karma">Karma Points</label>
            <input
              type="number"
              id="karma"
              name="karma"
              value={formData.karma}
              onChange={handleInputChange}
              required
              min="0"
              placeholder="e.g., 1000"
            />
          </div>
          <div className="form-group">
            <label htmlFor="personality">Personality Traits</label>
            <textarea
              id="personality"
              name="personality"
              value={formData.personality}
              onChange={handleInputChange}
              required
              placeholder="e.g., Sarcastic, witty, tends to play devil's advocate"
            />
          </div>
          <div className="form-group">
            <label htmlFor="interests">Interests & Expertise</label>
            <textarea
              id="interests"
              name="interests"
              value={formData.interests}
              onChange={handleInputChange}
              required
              placeholder="e.g., Gaming, programming, cryptocurrency, memes"
            />
          </div>
          <div className="form-group">
            <label htmlFor="writingStyle">Writing Style</label>
            <textarea
              id="writingStyle"
              name="writingStyle"
              value={formData.writingStyle}
              onChange={handleInputChange}
              required
              placeholder="e.g., Uses lots of emojis, writes in short sentences, frequently uses Reddit slang"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="cancel" onClick={handleCloseModal}>
              Cancel
            </button>
            <button type="submit" className="submit">
              {editingPersona ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PersonaBuilder; 
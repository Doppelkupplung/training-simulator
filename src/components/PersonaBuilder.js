import React, { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Modal from './Modal';
import './PersonaBuilder.css';
import Together from "together-ai";

const PersonaCard = ({ persona, index, moveCard, handleEditPersona, handleClonePersona, handleDelete, isCloning }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'PERSONA_CARD',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'PERSONA_CARD',
    hover: (item, monitor) => {
      if (!monitor.canDrop()) return;
      
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  return (
    <div 
      ref={(node) => drag(drop(node))}
      className={`persona-card ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {persona.imageUrl && (
        <div className="persona-image">
          <img 
            src={persona.imageUrl} 
            alt={`${persona.username}'s avatar`}
            className="persona-avatar"
          />
        </div>
      )}
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
          className="clone-button"
          onClick={() => handleClonePersona(persona)}
          disabled={isCloning}
        >
          {isCloning ? 'Cloning...' : 'Clone'}
        </button>
        <button 
          className="delete-button"
          onClick={() => handleDelete(persona)}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

function PersonaBuilder({ personas, onAddPersona, onEditPersona, onDeletePersona }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    personality: '',
    interests: '',
    writingStyle: ''
  });
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');

  const moveCard = (dragIndex, hoverIndex) => {
    const newPersonas = [...personas];
    const dragCard = newPersonas[dragIndex];
    newPersonas.splice(dragIndex, 1);
    newPersonas.splice(hoverIndex, 0, dragCard);
    
    // Update all personas with their new order
    const updatedPersonas = newPersonas.map((persona, index) => ({
      ...persona,
      order: index
    }));

    // Update the parent component with all reordered personas
    updatedPersonas.forEach(persona => {
      onEditPersona(persona);
    });
  };

  const handleAddPersona = () => {
    setEditingPersona(null);
    setFormData({
      username: '',
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

  const generatePersonaImage = async (interests) => {
    const together = new Together({ 
      apiKey: process.env.REACT_APP_TOGETHER_API_KEY 
    });
    
    try {
      const response = await together.images.create({
        prompt: interests,
        model: "black-forest-labs/FLUX.1-schnell",
        steps: 4,
      });
      return response.data[0].url;
    } catch (error) {
      console.error('Error generating image:', error);
      return null;
    }
  };

  const generateRandomKarma = () => {
    return Math.floor(Math.random() * (100000 - 100 + 1)) + 100;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    
    try {
      const imageUrl = await generatePersonaImage(formData.interests);
      
      const personaData = {
        ...formData,
        karma: generateRandomKarma(),
        imageUrl,
        order: personas.length,
      };

      if (editingPersona) {
        onEditPersona({ ...personaData, id: editingPersona.id, order: editingPersona.order });
      } else {
        onAddPersona(personaData);
      }
      handleCloseModal();
      setGeneratedImageUrl(null);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (persona) => {
    if (window.confirm(`Are you sure you want to delete u/${persona.username}?`)) {
      onDeletePersona(persona.id);
    }
  };

  const generateRandomUsername = () => {
    const adjectives = ['Cool', 'Super', 'Awesome', 'Epic', 'Cosmic', 'Digital', 'Cyber', 'Tech', 'Pixel', 'Neural'];
    const nouns = ['Ninja', 'Wizard', 'Dragon', 'Phoenix', 'Coder', 'Hacker', 'Sage', 'Master', 'Knight', 'Explorer'];
    const numbers = Math.floor(Math.random() * 999);
    
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${
      nouns[Math.floor(Math.random() * nouns.length)]}${numbers}`;
  };

  const generatePersonaFields = async () => {
    const together = new Together({ 
      apiKey: process.env.REACT_APP_TOGETHER_API_KEY 
    });
    
    try {
      setGenerationStatus('Generating persona details...');
      const response = await together.chat.completions.create({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a Reddit persona generator. You must respond in exactly this format:\nPersonality: [one sentence describing personality]\nInterests: [one sentence describing interests]\nWriting Style: [one sentence describing writing style]'
          },
          {
            role: 'user',
            content: 'Generate a unique Reddit user persona.'
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const output = response.choices[0].message.content;
      console.log('Raw LLM Response:', output);

      const personality = output.match(/Personality:\s*(.*?)(?=\n|$)/i)?.[1]?.trim();
      const interests = output.match(/Interests:\s*(.*?)(?=\n|$)/i)?.[1]?.trim();
      const writingStyle = output.match(/Writing Style:\s*(.*?)(?=\n|$)/i)?.[1]?.trim();

      console.log('Parsed fields:', { personality, interests, writingStyle });

      if (!personality || !interests || !writingStyle) {
        console.error('Parsing failed. Response format:', {
          raw: output,
          parsed: { personality, interests, writingStyle }
        });
        throw new Error('Failed to parse persona fields from response. Check console for details.');
      }

      return { personality, interests, writingStyle };
    } catch (error) {
      if (error.message.includes('Failed to parse')) {
        throw error;
      } else {
        console.error('API Error:', error);
        throw new Error('Failed to generate persona fields: API error');
      }
    }
  };

  const handleAddRandomPersona = async () => {
    setIsGenerating(true);
    setGenerationStatus('Starting generation...');
    
    try {
      const username = generateRandomUsername();
      setGenerationStatus('Generating persona details...');
      
      const fields = await generatePersonaFields();
      if (!fields) throw new Error('Failed to generate persona fields');

      const randomPersona = {
        username,
        ...fields
      };

      setGenerationStatus('Generating avatar image...');
      const imageUrl = await generatePersonaImage(randomPersona.interests);
      if (!imageUrl) throw new Error('Failed to generate image');
      
      const personaData = {
        ...randomPersona,
        karma: generateRandomKarma(),
        imageUrl,
        order: personas.length,
      };

      setGenerationStatus('Adding new persona...');
      onAddPersona(personaData);
      setGenerationStatus('');
    } catch (error) {
      console.error('Error generating random persona:', error);
      setGenerationStatus(`Error: ${error.message}`);
      setTimeout(() => setGenerationStatus(''), 3000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClonePersona = async (persona) => {
    setIsCloning(true);
    setGenerationStatus('Starting clone...');
    
    try {
      const username = generateRandomUsername();
      setGenerationStatus('Generating new personality...');
      
      const fields = await generatePersonaFields();
      if (!fields) throw new Error('Failed to generate persona fields');

      const clonedPersona = {
        username,
        personality: fields.personality,
        interests: persona.interests,
        writingStyle: persona.writingStyle,
        karma: generateRandomKarma()
      };

      setGenerationStatus('Generating new avatar...');
      const imageUrl = await generatePersonaImage(clonedPersona.interests);
      if (!imageUrl) throw new Error('Failed to generate image');
      
      const personaData = {
        ...clonedPersona,
        imageUrl,
      };

      setGenerationStatus('Adding cloned persona...');
      onAddPersona(personaData);
      setGenerationStatus('');
    } catch (error) {
      console.error('Error cloning persona:', error);
      setGenerationStatus(`Error: ${error.message}`);
      setTimeout(() => setGenerationStatus(''), 3000);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="persona-builder">
        <div className="persona-header">
          <h2>Persona Builder</h2>
          <div className="persona-header-buttons">
            <div className="button-container">
              <button 
                className="add-persona-button random"
                onClick={handleAddRandomPersona}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <div className="loading-spinner">
                    <span>Generating...</span>
                  </div>
                ) : (
                  'Add Random User'
                )}
              </button>
              {generationStatus && (
                <div className="generation-status">
                  {generationStatus}
                </div>
              )}
            </div>
            <button className="add-persona-button" onClick={handleAddPersona}>
              Add Reddit User
            </button>
          </div>
        </div>
        <div className="personas-list">
          {personas.length === 0 ? (
            <div className="empty-state">
              <p>No Reddit users created yet. Click "Add Reddit User" to get started.</p>
            </div>
          ) : (
            [...personas]
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((persona, index) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  index={index}
                  moveCard={moveCard}
                  handleEditPersona={handleEditPersona}
                  handleClonePersona={handleClonePersona}
                  handleDelete={handleDelete}
                  isCloning={isCloning}
                />
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
              <button 
                type="submit" 
                className="submit"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <div className="loading-spinner">
                    <span>Generating...</span>
                  </div>
                ) : (
                  editingPersona ? "Save Changes" : "Create User"
                )}
              </button>
            </div>
          </form>
        </Modal>

        {generatedImageUrl && (
          <div className="generated-image-preview">
            <img src={generatedImageUrl} alt="Generated persona" />
          </div>
        )}
      </div>
    </DndProvider>
  );
}

export default PersonaBuilder; 
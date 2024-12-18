import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import './ThreadBuilder.css';

const STORAGE_KEY = 'reddit_threads';

function ThreadBuilder() {
  const [threads, setThreads] = useState(() => {
    // Try to load threads from localStorage on initial render
    const savedThreads = localStorage.getItem(STORAGE_KEY);
    if (savedThreads) {
      try {
        return JSON.parse(savedThreads);
      } catch (e) {
        console.error('Failed to parse saved threads:', e);
      }
    }
    return [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newThread, setNewThread] = useState({
    subreddit: '',
    title: '',
    description: ''
  });

  // Save threads to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  const handleCreateThread = () => {
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Create new thread object
    const thread = {
      id: Date.now(),
      ...newThread,
      createdAt: new Date().toISOString(),
      upvotes: 1,
      comments: 0
    };

    // Add thread to list
    setThreads(prev => [...prev, thread]);

    // Reset form and close modal
    setNewThread({
      subreddit: '',
      title: '',
      description: ''
    });
    setIsModalOpen(false);
  };

  const handleDelete = (threadId) => {
    if (window.confirm('Are you sure you want to delete this thread?')) {
      setThreads(prev => prev.filter(thread => thread.id !== threadId));
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const threadTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - threadTime) / 1000 / 60);

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="thread-builder">
      <div className="thread-builder-header">
        <h2>Thread Builder</h2>
        <button 
          className="create-thread-button"
          onClick={handleCreateThread}
        >
          Create Reddit Thread
        </button>
      </div>

      <div className="threads-list">
        {threads.length === 0 ? (
          <div className="empty-state">
            <p>No threads created yet. Click the button above to create your first thread!</p>
          </div>
        ) : (
          threads.map(thread => (
            <div key={thread.id} className="thread-card">
              <div className="thread-card-header">
                <div className="thread-info">
                  <span className="subreddit">r/{thread.subreddit}</span>
                  <span className="dot">•</span>
                  <span className="timestamp">{formatTimestamp(thread.createdAt)}</span>
                </div>
                <button 
                  className="delete-button"
                  onClick={() => handleDelete(thread.id)}
                >
                  Delete
                </button>
              </div>
              <h3 className="thread-title">{thread.title}</h3>
              <p className="thread-description">{thread.description}</p>
              <div className="thread-stats">
                <span>{thread.upvotes} upvotes</span>
                <span className="dot">•</span>
                <span>{thread.comments} comments</span>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Thread"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Subreddit</label>
            <div className="subreddit-input">
              <span className="prefix">r/</span>
              <input
                type="text"
                value={newThread.subreddit}
                onChange={(e) => setNewThread(prev => ({ ...prev, subreddit: e.target.value }))}
                placeholder="politics"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={newThread.title}
              onChange={(e) => setNewThread(prev => ({ ...prev, title: e.target.value }))}
              placeholder="What are your thoughts on..."
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={newThread.description}
              onChange={(e) => setNewThread(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Share your thoughts..."
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="cancel" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="submit">
              Create Thread
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ThreadBuilder; 
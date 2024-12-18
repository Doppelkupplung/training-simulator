import React, { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Modal from './Modal';
import './ThreadBuilder.css';

const STORAGE_KEY = 'reddit_threads';

const ThreadCard = ({ thread, index, moveCard, handleDelete, handleClearThread, formatTimestamp }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'THREAD_CARD',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'THREAD_CARD',
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
      className={`thread-item ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="thread-card">
        <div className="thread-card-header">
          <div className="thread-info">
            <span className="subreddit">r/{thread.subreddit}</span>
            <span className="dot">•</span>
            <span className="timestamp">{formatTimestamp(thread.createdAt)}</span>
          </div>
          <div className="thread-card-actions">
            <button 
              className="thread-card-action clear-button"
              onClick={() => handleClearThread(thread.id)}
            >
              Clear Thread
            </button>
            <button 
              className="thread-card-action delete-button"
              onClick={() => handleDelete(thread.id)}
            >
              Delete
            </button>
          </div>
        </div>
        <div className="thread-content">
          <h3 className="thread-title">{thread.title}</h3>
          <p className="thread-description">{thread.description}</p>
        </div>
        <div className="thread-stats">
          <span>{thread.upvotes} upvotes</span>
          <span className="dot">•</span>
          <span>{thread.comments} comments</span>
        </div>
      </div>
    </div>
  );
};

function ThreadBuilder() {
  const [threads, setThreads] = useState(() => {
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

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      const savedThreads = localStorage.getItem(STORAGE_KEY);
      if (savedThreads) {
        try {
          setThreads(JSON.parse(savedThreads));
        } catch (e) {
          console.error('Failed to refresh threads:', e);
        }
      }
    }, 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  const moveCard = (dragIndex, hoverIndex) => {
    const dragCard = threads[dragIndex];
    setThreads(prevThreads => {
      const newThreads = [...prevThreads];
      newThreads.splice(dragIndex, 1);
      newThreads.splice(hoverIndex, 0, dragCard);
      return newThreads;
    });
  };

  const handleCreateThread = () => {
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const thread = {
      id: Date.now(),
      ...newThread,
      createdAt: new Date().toISOString(),
      upvotes: 1,
      comments: 0
    };

    setThreads(prev => [...prev, thread]);

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

  const handleClearThread = (threadId) => {
    if (window.confirm('Are you sure you want to clear all messages in this thread?')) {
      localStorage.removeItem(`reddit_simulator_messages_${threadId}`);
      
      const savedThreads = localStorage.getItem(STORAGE_KEY);
      if (savedThreads) {
        try {
          const threads = JSON.parse(savedThreads);
          const updatedThreads = threads.map(thread => {
            if (thread.id === threadId) {
              return {
                ...thread,
                comments: 0
              };
            }
            return thread;
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedThreads));
          setThreads(updatedThreads);
        } catch (e) {
          console.error('Failed to update thread comment count:', e);
        }
      }
      
      const event = new CustomEvent('threadCleared', { detail: { threadId } });
      window.dispatchEvent(event);
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
    <DndProvider backend={HTML5Backend}>
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
            threads.map((thread, index) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                index={index}
                moveCard={moveCard}
                handleDelete={handleDelete}
                handleClearThread={handleClearThread}
                formatTimestamp={formatTimestamp}
              />
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
    </DndProvider>
  );
}

export default ThreadBuilder; 
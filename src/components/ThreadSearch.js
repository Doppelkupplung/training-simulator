import React, { useState, useEffect } from 'react';
import './ThreadSearch.css';

function ThreadSearch({ onSearch, onThreadSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [threads, setThreads] = useState([]);

  // Load threads from localStorage
  useEffect(() => {
    const savedThreads = localStorage.getItem('reddit_threads');
    if (savedThreads) {
      try {
        setThreads(JSON.parse(savedThreads));
      } catch (e) {
        console.error('Failed to parse saved threads:', e);
      }
    }
  }, []);

  const handleSearch = (value) => {
    setSearchQuery(value);
    onSearch(value);

    // If search query is empty, don't show thread results
    if (!value.trim()) {
      setThreads([]);
      return;
    }

    // Load and filter threads
    const savedThreads = localStorage.getItem('reddit_threads');
    if (savedThreads) {
      try {
        const allThreads = JSON.parse(savedThreads);
        const query = value.toLowerCase();
        const filteredThreads = allThreads.filter(thread => 
          thread.title.toLowerCase().includes(query) ||
          thread.subreddit.toLowerCase().includes(query) ||
          thread.description.toLowerCase().includes(query)
        );
        setThreads(filteredThreads);
      } catch (e) {
        console.error('Failed to parse saved threads:', e);
      }
    }
  };

  const handleThreadSelect = (thread) => {
    onThreadSelect(thread);
    setSearchQuery(''); // Clear search after selection
    setThreads([]); // Hide results after selection
  };

  return (
    <div className="thread-search">
      <div className="search-container">
        <div className="search-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Search threads and messages..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      {threads.length > 0 && searchQuery.trim() && (
        <div className="thread-results">
          <div className="thread-results-header">Thread Results</div>
          {threads.map(thread => (
            <div 
              key={thread.id} 
              className="thread-result-item"
              onClick={() => handleThreadSelect(thread)}
            >
              <div className="thread-result-subreddit">r/{thread.subreddit}</div>
              <div className="thread-result-title">{thread.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThreadSearch; 
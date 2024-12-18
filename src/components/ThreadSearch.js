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
      <div className="thread-search-wrapper">
        <div className="reddit-branding">
          <div className="reddit-logo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" className="reddit-alien">
              <g>
                <circle fill="#FF4500" cx="10" cy="10" r="10"/>
                <path fill="#FFFFFF" d="M16.67,10A1.46,1.46,0,0,0,14.2,9a7.12,7.12,0,0,0-3.85-1.23L11,4.65,13.14,5.1a1,1,0,1,0,.13-0.61L10.82,4a0.31,0.31,0,0,0-.37.24L9.71,7.71a7.14,7.14,0,0,0-3.9,1.23A1.46,1.46,0,1,0,4.2,11.33a2.87,2.87,0,0,0,0,.44c0,2.24,2.61,4.06,5.83,4.06s5.83-1.82,5.83-4.06a2.87,2.87,0,0,0,0-.44A1.46,1.46,0,0,0,16.67,10Zm-10,1a1,1,0,1,1,1,1A1,1,0,0,1,6.67,11Zm5.81,2.75a3.84,3.84,0,0,1-2.47.77,3.84,3.84,0,0,1-2.47-.77,0.27,0.27,0,0,1,.38-0.38A3.27,3.27,0,0,0,10,14a3.28,3.28,0,0,0,2.09-.61A0.27,0.27,0,1,1,12.48,13.79Zm-0.18-1.71a1,1,0,1,1,1-1A1,1,0,0,1,12.29,12.08Z"/>
              </g>
            </svg>
          </div>
          <div className="reddit-text">readit</div>
        </div>
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
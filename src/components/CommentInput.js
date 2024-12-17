import React, { useState, useEffect, useRef } from 'react';

const CommentInput = ({ value, onChange, disabled, personas, onSubmit, onCancel }) => {
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.selectionStart = cursorPosition;
      textareaRef.current.selectionEnd = cursorPosition;
    }
  }, [cursorPosition]);

  const getCaretCoordinates = () => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0 };

    const { selectionStart, scrollLeft, scrollTop } = textarea;
    const textBeforeCursor = value.slice(0, selectionStart);
    
    // Find the current line and column
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLine = lines[currentLineIndex];
    
    // Create a temporary span to measure text
    const span = document.createElement('span');
    span.style.font = getComputedStyle(textarea).font;
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    span.textContent = currentLine;
    document.body.appendChild(span);
    
    const textWidth = span.offsetWidth;
    document.body.removeChild(span);

    // Calculate position
    const { paddingLeft, paddingTop, lineHeight } = getComputedStyle(textarea);
    const pLeft = parseInt(paddingLeft);
    const pTop = parseInt(paddingTop);
    const lHeight = parseInt(lineHeight);

    return {
      left: pLeft + textWidth - scrollLeft,
      top: pTop + (currentLineIndex * lHeight) - scrollTop
    };
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    const newPosition = e.target.selectionStart;
    
    // Find the word being typed
    const textBeforeCursor = newValue.slice(0, newPosition);
    const words = textBeforeCursor.split(/\s/);
    const currentWord = words[words.length - 1];

    // Check if we're typing a username (starts with @)
    if (currentWord.startsWith('@')) {
      const searchTerm = currentWord.slice(1).toLowerCase();
      const matchingPersonas = personas
        .filter(p => p.username.toLowerCase().includes(searchTerm))
        .map(p => p.username);
      
      setSuggestions(matchingPersonas);
      
      if (matchingPersonas.length > 0) {
        const coords = getCaretCoordinates();
        setDropdownPosition(coords);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
      setSelectedSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
    }

    onChange(e);
    setCursorPosition(newPosition);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : prev
      );
    } else if (e.key === 'Enter' && showSuggestions) {
      e.preventDefault();
      insertSuggestion(suggestions[selectedSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const insertSuggestion = (username) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];
    const textWithoutLastWord = textBeforeCursor.slice(0, -lastWord.length);
    
    const newText = textWithoutLastWord + '@' + username + ' ' + textAfterCursor;
    const newCursorPosition = textWithoutLastWord.length + username.length + 2;
    
    onChange({ target: { value: newText } });
    setCursorPosition(newCursorPosition);
    setShowSuggestions(false);
  };

  return (
    <div className="comment-input-wrapper">
      <textarea
        ref={textareaRef}
        placeholder="What are your thoughts?"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="comment-input"
      />
      {showSuggestions && (
        <div 
          className="username-suggestions"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          {suggestions.map((username, index) => (
            <div
              key={username}
              className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
              onClick={() => insertSuggestion(username)}
            >
              {username}
            </div>
          ))}
        </div>
      )}
      <div className="reply-actions">
        <button onClick={onCancel}>Cancel</button>
        <button 
          onClick={onSubmit}
          disabled={!value.trim() || disabled}
        >
          Comment
        </button>
      </div>
    </div>
  );
};

export default CommentInput; 
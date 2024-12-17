import React, { useState } from 'react';

const ReplyInput = ({ onSubmit, isStreaming }) => {
  const [replyContent, setReplyContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(replyContent);
    setReplyContent('');
  };

  return (
    <form className="reply-input-form" onSubmit={handleSubmit}>
      <div className="reply-input-container">
        <textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="What are your thoughts?"
          className="reply-input"
          disabled={isStreaming}
        />
        <button 
          type="submit" 
          className={`reply-submit ${isStreaming ? 'disabled' : ''}`}
          disabled={isStreaming}
        >
          Reply
        </button>
      </div>
    </form>
  );
};

export default ReplyInput; 
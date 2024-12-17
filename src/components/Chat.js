import React, { useState, useEffect, useRef } from 'react';
import { Together } from 'together-ai';
import config from '../config';
import './Chat.css';
import ReplyInput from './ReplyInput';

let together = null;
let initError = null;

try {
  if (!config.togetherApiKey) {
    throw new Error('Together AI API key is not configured');
  }
  together = new Together({ apiKey: config.togetherApiKey });
  console.log('Together AI client initialized');
} catch (error) {
  console.error('Failed to initialize Together AI:', error);
  initError = error.message;
}

function Chat({ personas }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: "Welcome to the thread! Feel free to start a discussion, and one of our community members will respond.",
      username: 'AutoModerator',
      karma: 1000000,
      timestamp: new Date().toISOString(),
      replies: [],
      isReplyOpen: false
    }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(initError);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (initError) {
      setError(initError);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getRandomPersona = () => {
    if (!personas || personas.length === 0) {
      return {
        username: 'DefaultRedditor',
        karma: 100,
        personality: 'Helpful and friendly',
        interests: 'General discussion',
        writingStyle: 'Casual and informative'
      };
    }
    return personas[Math.floor(Math.random() * personas.length)];
  };

  const toggleReply = (messageId) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isReplyOpen: !msg.isReplyOpen }
        : msg
    ));
  };

  const handleReply = async (messageId, replyContent) => {
    if (!replyContent.trim()) return;

    const newReply = {
      id: Date.now(),
      role: 'user',
      content: replyContent,
      username: 'You',
      karma: 1,
      timestamp: new Date().toISOString(),
      replies: [],
      isReplyOpen: false
    };

    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            replies: [...msg.replies, newReply],
            isReplyOpen: false 
          }
        : msg
    ));

    await generateResponse(replyContent, messageId);
  };

  const generateResponse = async (userMessage, parentId = null) => {
    if (!together) {
      const errorMessage = 'Chat service is not available. Please check your API key configuration.';
      console.error(errorMessage);
      setError(errorMessage);
      return;
    }

    try {
      setIsStreaming(true);
      setError(null);
      
      const respondingPersona = getRandomPersona();
      console.log('Selected persona:', respondingPersona);

      const systemPrompt = `You are roleplaying as a Reddit user with the following profile:
Username: ${respondingPersona.username}
Karma: ${respondingPersona.karma}
Personality: ${respondingPersona.personality}
Interests: ${respondingPersona.interests}
Writing Style: ${respondingPersona.writingStyle}

Respond to the conversation in character, maintaining consistency with your profile's personality and writing style. Use Reddit formatting and terminology where appropriate. Your response should reflect your interests and expertise.`;
      
      console.log('Generating response for:', userMessage);
      const stream = await together.chat.completions.create({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage }
        ],
        stream: true,
        max_tokens: 500,
        temperature: 0.7,
      });

      let responseContent = '';

      if (!parentId) {
        // Only create a new main message if this isn't a reply
        const responseId = messages.length + 2;
        setMessages(prev => [...prev, {
          id: responseId,
          role: 'assistant',
          content: '',
          username: respondingPersona.username,
          karma: respondingPersona.karma,
          timestamp: new Date().toISOString(),
          replies: [],
          isReplyOpen: false
        }]);

        // Stream the response for main message
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          responseContent += content;
          setMessages(prev => prev.map(msg => 
            msg.id === responseId 
              ? { ...msg, content: msg.content + content }
              : msg
          ));
        }
      } else {
        // For replies, accumulate the content first
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          responseContent += content;
        }

        // Then add the complete reply to the parent message
        setMessages(prev => prev.map(msg => 
          msg.id === parentId 
            ? { 
                ...msg, 
                replies: [...msg.replies, {
                  id: Date.now(),
                  role: 'assistant',
                  content: responseContent,
                  username: respondingPersona.username,
                  karma: respondingPersona.karma,
                  timestamp: new Date().toISOString(),
                  replies: [],
                  isReplyOpen: false
                }]
              }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage = error.message || 'Failed to generate response. Please try again.';
      setError(errorMessage);
      
      if (!parentId) {
        // Only add error message to main thread if it's not a reply
        const defaultPersona = getRandomPersona();
        setMessages(prev => [...prev, {
          id: messages.length + 2,
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.',
          username: defaultPersona.username,
          karma: defaultPersona.karma,
          timestamp: new Date().toISOString(),
          replies: [],
          isReplyOpen: false
        }]);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input;
    setInput('');
    setError(null);

    // Add user message with all required properties
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      role: 'user',
      content: userMessage,
      username: 'You',
      karma: 1,
      timestamp: new Date().toISOString(),
      replies: [],
      isReplyOpen: false
    }]);

    // Generate AI response
    await generateResponse(userMessage);
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageTime) / 1000 / 60);

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div style={{ 
      margin: 0,
      padding: 0,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="chat-container">
        <div className="thread-title">
          <h2>Reddit Thread Simulator</h2>
          <div className="thread-info">
            <span className="thread-stats">100% Upvoted</span>
            <span className="thread-stats">•</span>
            <span className="thread-stats">r/ThreadSimulator</span>
          </div>
        </div>
        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`reddit-comment ${message.role}`}>
              <div className="comment-metadata">
                <span className="username">u/{message.username}</span>
                <span className="karma-dot">•</span>
                <span className="karma">{message.karma} karma</span>
                <span className="karma-dot">•</span>
                <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
              </div>
              <div className="comment-content">
                {message.content}
                {message.id === messages.length && isStreaming && (
                  <span className="typing-indicator">▊</span>
                )}
              </div>
              <div className="comment-actions">
                <button className="action-button">
                  <span className="arrow-up">▲</span> Upvote
                </button>
                <button className="action-button">
                  <span className="arrow-down">▼</span> Downvote
                </button>
                <button 
                  className="action-button"
                  onClick={() => toggleReply(message.id)}
                >
                  Reply
                </button>
                <button className="action-button">Share</button>
                <button className="action-button">Report</button>
              </div>

              {message.isReplyOpen && (
                <div className="reply-form">
                  <ReplyInput 
                    onSubmit={(content) => handleReply(message.id, content)}
                    isStreaming={isStreaming}
                  />
                </div>
              )}

              {message.replies.length > 0 && (
                <div className="nested-replies">
                  {message.replies.map(reply => (
                    <div key={reply.id} className={`reddit-comment ${reply.role}`}>
                      <div className="comment-metadata">
                        <span className="username">u/{reply.username}</span>
                        <span className="karma-dot">•</span>
                        <span className="karma">{reply.karma} karma</span>
                        <span className="karma-dot">•</span>
                        <span className="timestamp">{formatTimestamp(reply.timestamp)}</span>
                      </div>
                      <div className="comment-content">
                        {reply.content}
                        {reply.id === messages.length && isStreaming && (
                          <span className="typing-indicator">▊</span>
                        )}
                      </div>
                      <div className="comment-actions">
                        <button className="action-button">
                          <span className="arrow-up">▲</span> Upvote
                        </button>
                        <button className="action-button">
                          <span className="arrow-down">▼</span> Downvote
                        </button>
                        <button className="action-button">Reply</button>
                        <button className="action-button">Share</button>
                        <button className="action-button">Report</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {error && (
            <div className="error-message">
              <div className="error-title">Error</div>
              <div className="error-content">{error}</div>
              {config.isDevelopment && (
                <div className="error-debug">
                  API Key status: {config.togetherApiKey ? 'Configured' : 'Missing'}
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <div className="chat-input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? "Waiting for response..." : "What are your thoughts?"}
              className="chat-input"
              disabled={isStreaming || !together}
            />
            <button 
              type="submit" 
              className={`chat-submit ${(isStreaming || !together) ? 'disabled' : ''}`}
              disabled={isStreaming || !together}
            >
              Comment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Chat; 
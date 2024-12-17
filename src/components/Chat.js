import React, { useState, useEffect, useRef } from 'react';
import { Together } from 'together-ai';
import config from '../config';
import './Chat.css';

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

function Chat() {
  console.log('Chat component rendering');
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'Hello! I am your virtual customer. How can I help you practice your customer service skills today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(initError);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Set initial error if Together AI failed to initialize
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

  const generateResponse = async (userMessage) => {
    if (!together) {
      const errorMessage = 'Chat service is not available. Please check your API key configuration.';
      console.error(errorMessage);
      setError(errorMessage);
      return;
    }

    try {
      setIsStreaming(true);
      setError(null);
      
      console.log('Generating response for:', userMessage);
      const stream = await together.chat.completions.create({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a virtual customer helping customer service representatives practice their skills. Respond as a customer would, with realistic concerns, questions, and reactions.'
          },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage }
        ],
        stream: true,
        max_tokens: 500,
        temperature: 0.7,
      });

      // Create a new message for streaming response
      const responseId = messages.length + 2;
      setMessages(prev => [...prev, {
        id: responseId,
        role: 'assistant',
        content: ''
      }]);

      // Stream the response
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        setMessages(prev => prev.map(msg => 
          msg.id === responseId 
            ? { ...msg, content: msg.content + content }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage = error.message || 'Failed to generate response. Please try again.';
      setError(errorMessage);
      setMessages(prev => [...prev, {
        id: messages.length + 2,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.'
      }]);
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

    // Add user message
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      role: 'user',
      content: userMessage
    }]);

    // Generate AI response
    await generateResponse(userMessage);
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-icon">
              {message.role === 'assistant' ? '👤' : '💬'}
            </div>
            <div className="message-content">
              {message.content}
              {message.id === messages.length && isStreaming && (
                <span className="typing-indicator">▊</span>
              )}
            </div>
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
            placeholder={isStreaming ? "Waiting for response..." : "Type your message here..."}
            className="chat-input"
            disabled={isStreaming || !together}
          />
          <button 
            type="submit" 
            className={`chat-submit ${(isStreaming || !together) ? 'disabled' : ''}`}
            disabled={isStreaming || !together}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

export default Chat; 
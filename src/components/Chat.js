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

const selectBestPersona = async (userMessage, availablePersonas, messageHistory = []) => {
  if (!availablePersonas || availablePersonas.length === 0) {
    console.log('No available personas to select from');
    return null;
  }

  try {
    // First check for direct mentions of usernames in the message
    for (const persona of availablePersonas) {
      const usernamePattern = new RegExp(`@?u/${persona.username}\\b|@${persona.username}\\b`, 'i');
      if (usernamePattern.test(userMessage)) {
        console.log(`Found direct mention of ${persona.username}`);
        return {
          persona,
          analysis: {
            isConversationContinuation: true,
            previousSpeaker: persona.username,
            directMention: true
          }
        };
      }
    }

    // Format the recent message history for the LLM
    const recentMessages = messageHistory
      .slice(-3) // Get last 3 messages for context
      .map(msg => `u/${msg.username}: ${msg.content}`)
      .join('\n');

    // Create a prompt that asks the LLM to analyze the message and select the best persona
    const analysisPrompt = `You are a conversation analyzer. Your task is to analyze a message and select the most appropriate Reddit user to respond based on the following criteria in order:

1. Direct mentions (already checked by code)
2. Conversation continuity - check if the message is continuing a discussion that one of the personas was involved in
3. Interest matching - if no conversation is being continued, select based on matching interests

Recent conversation:
${recentMessages}

New message to analyze: "${userMessage}"

Available personas:
${availablePersonas.map((p, i) => `
${i + 1}. Username: ${p.username}
   Interests & Expertise: ${p.interests}`).join('\n')}

Instructions:
1. First, identify if this message is continuing a previous conversation or topic with a specific persona
2. If it is continuing a conversation, select that persona if available
3. If it's a new topic, compare the message topics with each persona's interests and expertise
4. Explain your selection reasoning

Format your response EXACTLY like this:
Conversation Analysis: [Is this continuing a previous discussion? Yes/No]
Previous Speaker: [username of the persona this is responding to, if any]
Topic: [topic from message]
Selected Persona: [number]
Reasoning: [2-3 sentences explaining why this persona was selected]

End your response with ONLY the number on the last line, like this example:
Conversation Analysis: Yes
Previous Speaker: u/TechGamer404
Topic: Gaming strategies in Minecraft
Selected Persona: 2
Reasoning: This message is directly responding to TechGamer404's previous comment about Minecraft building techniques.

2`;

    const response = await together.chat.completions.create({
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a conversation analyzer that selects the most relevant persona based on conversation continuity first, then interest matching.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
    });

    const fullResponse = response.choices[0].message.content;
    
    // Debug the full selection process
    console.log('\n=== FULL PERSONA SELECTION DEBUG ===');
    console.log('User Message:', userMessage);
    console.log('Available Personas:', availablePersonas.map((p, i) => ({
      index: i + 1,
      username: p.username,
      interests: p.interests
    })));
    console.log('\nLLM Response:', fullResponse);
    
    // Extract the last line and parse the index
    const lines = fullResponse.split('\n').filter(line => line.trim());
    console.log('\nParsing Process:');
    console.log('All non-empty lines:', JSON.stringify(lines, null, 2));
    
    // Parse conversation analysis
    const isConversationContinuation = lines.some(line => 
      line.startsWith('Conversation Analysis:') && 
      line.toLowerCase().includes('yes')
    );
    const previousSpeakerMatch = lines.find(line => 
      line.startsWith('Previous Speaker:')
    );
    const previousSpeaker = previousSpeakerMatch ? 
      previousSpeakerMatch.split(':')[1].trim().replace('u/', '') : 
      null;
    
    // Find the selected persona number using multiple methods
    let selectedIndex = -1;
    
    // Method 1: Look for "Selected Persona: [number]"
    const selectedPersonaLine = lines.find(line => line.startsWith('Selected Persona:'));
    if (selectedPersonaLine) {
      const match = selectedPersonaLine.match(/Selected Persona:\s*(\d+)/);
      if (match) {
        selectedIndex = parseInt(match[1]) - 1;
        console.log('\nFound number in Selected Persona line:', match[1]);
      }
    }

    // Method 2: Check if the last line is just a number
    if (selectedIndex === -1) {
      const lastLine = lines[lines.length - 1].trim();
      if (/^\d+$/.test(lastLine)) {
        selectedIndex = parseInt(lastLine) - 1;
        console.log('\nFound clean number at end:', lastLine);
      }
    }

    // Method 3: Look for any line that's just a number
    if (selectedIndex === -1) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (/^\d+$/.test(line)) {
          selectedIndex = parseInt(line) - 1;
          console.log('\nFound standalone number:', line);
          break;
        }
      }
    }
    
    console.log('\nSelection Results:');
    console.log('Final selected index:', selectedIndex);
    console.log('Valid index range: 0 to', availablePersonas.length - 1);
    
    // If this is a conversation continuation and we have a previous speaker,
    // prioritize selecting that persona
    if (isConversationContinuation && previousSpeaker) {
      const previousPersonaIndex = availablePersonas.findIndex(p => p.username === previousSpeaker);
      if (previousPersonaIndex !== -1) {
        console.log('\nOverriding selection to maintain conversation continuity with:', previousSpeaker);
        selectedIndex = previousPersonaIndex;
      }
    }
    
    // Return the selected persona and analysis or fall back to random persona if parsing fails
    if (selectedIndex >= 0 && selectedIndex < availablePersonas.length) {
      const selectedPersona = availablePersonas[selectedIndex];
      console.log('\nSUCCESS: Selected persona', selectedIndex + 1, ':', selectedPersona.username);
      console.log('=================================\n');
      return {
        persona: selectedPersona,
        analysis: {
          isConversationContinuation,
          previousSpeaker,
          directMention: false
        }
      };
    } else {
      // If we failed to parse a valid index, and this is a conversation continuation,
      // try to use the previous speaker directly
      if (isConversationContinuation && previousSpeaker) {
        const previousPersona = availablePersonas.find(p => p.username === previousSpeaker);
        if (previousPersona) {
          console.log('\nFallback: Using previous speaker for conversation continuation:', previousSpeaker);
          return {
            persona: previousPersona,
            analysis: {
              isConversationContinuation: true,
              previousSpeaker,
              directMention: false
            }
          };
        }
      }

      // Last resort: random selection
      const randomIndex = Math.floor(Math.random() * availablePersonas.length);
      const randomPersona = availablePersonas[randomIndex];
      console.warn('\nFAILED to select valid persona, using random selection:');
      console.warn('- Selected random persona:', randomPersona.username);
      console.log('=================================\n');
      return {
        persona: randomPersona,
        analysis: {
          isConversationContinuation: false,
          previousSpeaker: null,
          directMention: false
        }
      };
    }

  } catch (error) {
    console.error('Error selecting persona:', error);
    // Fallback to random persona if there's an error
    const randomIndex = Math.floor(Math.random() * availablePersonas.length);
    return {
      persona: availablePersonas[randomIndex],
      analysis: {
        isConversationContinuation: false,
        previousSpeaker: null,
        directMention: false
      }
    };
  }
};

const STORAGE_KEY = 'reddit_simulator_messages';

function Chat({ personas }) {
  const [messages, setMessages] = useState(() => {
    // Try to load messages from localStorage on initial render
    const savedMessages = localStorage.getItem(STORAGE_KEY);
    if (savedMessages) {
      try {
        return JSON.parse(savedMessages);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    // Fall back to default initial message if no saved messages or parsing fails
    return [{
      id: 1,
      role: 'assistant',
      content: "Welcome to the thread! Feel free to start a discussion, and one of our community members will respond.",
      username: 'AutoModerator',
      karma: 1000000,
      timestamp: new Date().toISOString(),
      replies: [],
      isReplyOpen: false,
      upvotes: 1,
      downvotes: 0
    }];
  });

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(initError);
  const [generatingPersona, setGeneratingPersona] = useState(null);
  const messagesEndRef = useRef(null);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');

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

  const toggleReply = (messageId, replyId = null) => {
    setMessages(prev => prev.map(msg => {
      if (replyId) {
        // Handle reply to a reply
        return msg.id === messageId 
          ? {
              ...msg,
              replies: msg.replies.map(reply =>
                reply.id === replyId
                  ? { ...reply, isReplyOpen: !reply.isReplyOpen }
                  : { ...reply, isReplyOpen: false }
              )
            }
          : msg;
      }
      // Handle reply to main message
      return msg.id === messageId 
        ? { ...msg, isReplyOpen: !msg.isReplyOpen }
        : { ...msg, isReplyOpen: false };
    }));
  };

  const handleVote = (messageId, isUpvote, isReply = false, parentId = null) => {
    setMessages(prev => {
      if (isReply) {
        return prev.map(msg => 
          msg.id === parentId 
            ? {
                ...msg,
                replies: msg.replies.map(reply =>
                  reply.id === messageId
                    ? {
                        ...reply,
                        upvotes: isUpvote ? reply.upvotes + 1 : reply.upvotes,
                        downvotes: !isUpvote ? reply.downvotes + 1 : reply.downvotes
                      }
                    : reply
                )
              }
            : msg
        );
      }
      return prev.map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              upvotes: isUpvote ? msg.upvotes + 1 : msg.upvotes,
              downvotes: !isUpvote ? msg.downvotes + 1 : msg.downvotes
            }
          : msg
      );
    });
  };

  const getNestingLevel = (parentId, replyToReplyId) => {
    if (!parentId) return 0; // Main message
    
    const parentMessage = messages.find(m => m.id === parentId);
    if (!parentMessage) return 0;
    
    if (!replyToReplyId) return 1; // Direct reply to main message
    
    const reply = parentMessage.replies.find(r => r.id === replyToReplyId);
    if (!reply) return 1;
    
    return reply.replies ? 3 : 2; // If reply already has replies, it's level 3, otherwise level 2
  };

  const generateRandomReply = async (messageContent, messageId, parentId = null, aiResponseCount = 1) => {
    // Stop if we've reached 2 consecutive AI responses
    if (aiResponseCount >= 2) {
      console.log('Reached maximum AI response chain (2), stopping');
      return;
    }

    // Check nesting level before proceeding
    const currentNestLevel = getNestingLevel(parentId, messageId);
    
    // Find the message that was just replied to
    const parentMessage = parentId 
      ? messages.find(m => m.id === parentId)
      : messages.find(m => m.id === messageId);
    
    if (parentMessage) {
      // Get the username of the last person who replied and the immediate parent
      let lastResponderUsername = null;
      let immediateParentUsername = null;
      let targetMessageId;
      let targetParentId;
      
      if (currentNestLevel >= 3) {
        // At max nesting level, stay in the same layer by using the parent's parent
        const reply = parentMessage.replies?.find(r => r.id === messageId);
        if (reply) {
          lastResponderUsername = reply.username;
          immediateParentUsername = reply.username;
          targetMessageId = reply.id;
          targetParentId = parentId;
        } else {
          lastResponderUsername = parentMessage.username;
          immediateParentUsername = parentMessage.username;
          targetMessageId = messageId;
          targetParentId = parentId;
        }
      } else if (parentId && messageId) {
        // For nested replies, find the last reply in the chain
        const reply = parentMessage.replies?.find(r => r.id === messageId);
        if (reply?.replies?.length > 0) {
          const lastNestedReply = reply.replies[reply.replies.length - 1];
          lastResponderUsername = lastNestedReply.username;
          immediateParentUsername = reply.username;
        } else {
          lastResponderUsername = reply?.username;
          immediateParentUsername = reply?.username;
        }
        targetMessageId = messageId;
        targetParentId = parentId;
      } else {
        // For direct replies, get the last reply
        const replies = parentMessage.replies || [];
        lastResponderUsername = replies.length > 0 
          ? replies[replies.length - 1].username 
          : parentMessage.username;
        immediateParentUsername = parentMessage.username;
        targetMessageId = messageId;
        targetParentId = parentId;
      }
      
      // Filter out both the last responder and the immediate parent from available personas
      const availablePersonas = personas.filter(p => 
        p.username !== lastResponderUsername && 
        p.username !== immediateParentUsername
      );
      
      // 70% chance to generate a reply if we have available personas
      if (availablePersonas.length > 0 && Math.random() < 0.7) {
        // Wait a random time between 2-5 seconds before starting the reply
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        
        // Create a prompt that references the previous message and encourages engagement
        const replyPrompt = `You are participating in a Reddit thread. Reply to this message in a way that encourages further discussion: "${messageContent}"`;
        
        // Generate a reply with the correct parent ID and increment the AI response count
        if (targetParentId) {
          // If we have a parentId, this is a nested reply
          generateResponse(replyPrompt, targetParentId, targetMessageId, true, aiResponseCount + 1);
        } else {
          // This is a direct reply to the message
          generateResponse(replyPrompt, targetMessageId, null, true, aiResponseCount + 1);
        }
      }
    }
  };

  const generateResponse = async (userMessage, parentId = null, replyToReplyId = null, isRandomReply = false, aiResponseCount = 1) => {
    if (!together) {
      const errorMessage = 'Chat service is not available. Please check your API key configuration.';
      console.error(errorMessage);
      setError(errorMessage);
      return;
    }

    // Check if we've reached the maximum AI response chain (except for user-initiated responses)
    if (isRandomReply && aiResponseCount >= 2) {
      console.log('Reached maximum AI response chain (2), stopping');
      return;
    }

    // Check nesting level and adjust target IDs if needed
    const currentNestLevel = getNestingLevel(parentId, replyToReplyId);
    let targetParentId = parentId;
    let targetReplyToReplyId = replyToReplyId;

    if (currentNestLevel >= 3) {
      // At level 3, we want to add the reply at the same level
      // So we keep the same parent ID but use null for replyToReplyId
      targetReplyToReplyId = null;
    }

    try {
      setIsStreaming(true);
      setError(null);
      
      // Build message history based on the context
      let messageHistory = [];
      if (replyToReplyId) {
        // Find the parent message and its reply chain
        const parentMessage = messages.find(m => m.id === parentId);
        if (parentMessage) {
          messageHistory.push(parentMessage);
          const reply = parentMessage.replies.find(r => r.id === replyToReplyId);
          if (reply) {
            messageHistory.push(reply);
            // Add any nested replies
            reply.replies?.forEach(nestedReply => {
              messageHistory.push(nestedReply);
            });
          }
        }
      } else if (parentId) {
        // Find the parent message and its replies
        const parentMessage = messages.find(m => m.id === parentId);
        if (parentMessage) {
          messageHistory.push(parentMessage);
          parentMessage.replies.forEach(reply => {
            messageHistory.push(reply);
          });
        }
      } else {
        // Use last few messages for context in main thread
        messageHistory = messages.slice(-3);
      }

      // First try to select a persona based on conversation continuity
      const result = await selectBestPersona(userMessage, personas, messageHistory);
      if (!result) {
        console.log('No persona selected');
        return;
      }

      const { persona: selectedPersona, analysis } = result;
      console.log('Conversation Analysis:', analysis);

      // Get the usernames for checking self-replies
      const lastResponderUsername = messageHistory.length > 0 ? messageHistory[messageHistory.length - 1].username : null;
      const immediateParentUsername = messageHistory.length > 0 ? messageHistory[0].username : null;

      // If this is a direct mention or conversation continuation, always use the selected persona
      if (analysis.directMention || analysis.isConversationContinuation) {
        console.log('Using selected persona due to direct mention or conversation continuation:', selectedPersona.username);
        setGeneratingPersona(selectedPersona);
      } else {
        // For new topics, avoid self-replies
        if (selectedPersona.username === lastResponderUsername || selectedPersona.username === immediateParentUsername) {
          // Try to find a different persona for new topics
          const otherPersonas = personas.filter(p => 
            p.username !== lastResponderUsername && 
            p.username !== immediateParentUsername
          );

          if (otherPersonas.length > 0) {
            console.log('New topic - selecting from other available personas');
            const newResult = await selectBestPersona(userMessage, otherPersonas, messageHistory);
            if (newResult) {
              setGeneratingPersona(newResult.persona);
            } else {
              console.log('No other personas available to respond');
              return;
            }
          } else {
            console.log('No other personas available to avoid self-replies');
            return;
          }
        } else {
          setGeneratingPersona(selectedPersona);
        }
      }

      console.log('\n=== Persona Selection Results ===');
      console.log('User Message:', userMessage);
      console.log('Last Responder:', lastResponderUsername);
      console.log('Immediate Parent:', immediateParentUsername);
      console.log('Is Conversation Continuation:', analysis.isConversationContinuation);
      console.log('Previous Speaker:', analysis.previousSpeaker);
      console.log('Selected Persona:', {
        username: selectedPersona.username,
        karma: selectedPersona.karma,
        personality: selectedPersona.personality,
        interests: selectedPersona.interests,
        writingStyle: selectedPersona.writingStyle
      });
      console.log('===============================\n');

      const systemPrompt = `You are roleplaying as a Reddit user with the following profile:
Username: ${selectedPersona.username}
Karma: ${selectedPersona.karma}
Personality: ${selectedPersona.personality}
Interests: ${selectedPersona.interests}
Writing Style: ${selectedPersona.writingStyle}

Respond to the conversation in character, maintaining consistency with your profile's personality and writing style. Use Reddit formatting and terminology where appropriate. Your response should reflect your interests and expertise.`;
      
      // Use the already built message history for the chat context
      const chatMessages = messageHistory.map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      }));

      console.log('Generating response for:', userMessage);
      const stream = await together.chat.completions.create({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...chatMessages,
          { role: 'user', content: userMessage }
        ],
        stream: true,
        max_tokens: 500,
        temperature: 0.7,
      });

      let responseContent = '';
      let newMessageId;

      if (targetReplyToReplyId) {
        // For replies to replies, accumulate the content first
        for await (const chunk of stream) {
          const chunkContent = chunk.choices[0]?.delta?.content || '';
          responseContent += chunkContent;
        }

        newMessageId = Date.now();
        // Then add the complete reply to the nested reply
        setMessages(prev => prev.map(msg =>
          msg.id === targetParentId
            ? {
                ...msg,
                replies: msg.replies.map(reply =>
                  reply.id === targetReplyToReplyId
                    ? {
                        ...reply,
                        replies: [...(reply.replies || []), {
                          id: newMessageId,
                          role: 'assistant',
                          content: responseContent,
                          username: selectedPersona.username,
                          karma: selectedPersona.karma,
                          timestamp: new Date().toISOString(),
                          upvotes: 0,
                          downvotes: 0,
                          replies: [],
                          isReplyOpen: false
                        }]
                      }
                    : reply
                )
              }
            : msg
        ));

      } else if (targetParentId) {
        // For replies, accumulate the content first
        for await (const chunk of stream) {
          const chunkContent = chunk.choices[0]?.delta?.content || '';
          responseContent += chunkContent;
        }

        newMessageId = Date.now();
        // Then add the complete reply to the parent message
        setMessages(prev => prev.map(msg => 
          msg.id === targetParentId 
            ? { 
                ...msg, 
                replies: [...msg.replies, {
                  id: newMessageId,
                  role: 'assistant',
                  content: responseContent,
                  username: selectedPersona.username,
                  karma: selectedPersona.karma,
                  timestamp: new Date().toISOString(),
                  replies: [],
                  isReplyOpen: false,
                  upvotes: 0,
                  downvotes: 0
                }]
              }
            : msg
        ));

      } else {
        // Only create a new main message if this isn't a reply
        newMessageId = messages.length + 2;
        setMessages(prev => [...prev, {
          id: newMessageId,
          role: 'assistant',
          content: '',
          username: selectedPersona.username,
          karma: selectedPersona.karma,
          timestamp: new Date().toISOString(),
          replies: [],
          isReplyOpen: false,
          upvotes: 0,
          downvotes: 0
        }]);

        // Stream the response for main message
        for await (const chunk of stream) {
          const chunkContent = chunk.choices[0]?.delta?.content || '';
          responseContent += chunkContent;
          setMessages(prev => prev.map(msg => 
            msg.id === newMessageId 
              ? { ...msg, content: msg.content + chunkContent }
              : msg
          ));
        }
      }

      // After any persona responds, maybe generate a random reply with the current AI response count
      if (selectedPersona.username !== 'AutoModerator') {
        await generateRandomReply(responseContent, newMessageId, targetParentId, aiResponseCount);
      }

    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage = error.message || 'Failed to generate response. Please try again.';
      setError(errorMessage);
      
      if (!targetParentId) {
        // Only add error message to main thread if it's not a reply
        setMessages(prev => [...prev, {
          id: messages.length + 2,
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.',
          username: 'AutoModerator',
          karma: 1000000,
          timestamp: new Date().toISOString(),
          replies: [],
          isReplyOpen: false,
          upvotes: 0,
          downvotes: 0
        }]);
      }
    } finally {
      setIsStreaming(false);
      setGeneratingPersona(null);
    }
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

  const handleAddComment = () => {
    setIsReplying(true);
  };

  const handleSubmitReply = (messageId, replyId = null) => {
    if (!replyText.trim() || isStreaming) return;

    const userMessage = replyText;
    setReplyText('');
    setError(null);

    setMessages(prev => prev.map(msg => {
      if (replyId) {
        // Add reply to a reply
        return msg.id === messageId
          ? {
              ...msg,
              replies: msg.replies.map(reply =>
                reply.id === replyId
                  ? {
                      ...reply,
                      replies: [...(reply.replies || []), {
                        id: Date.now(),
                        role: 'user',
                        content: userMessage,
                        username: 'You',
                        karma: 1,
                        timestamp: new Date().toISOString(),
                        upvotes: 0,
                        downvotes: 0,
                        replies: [],
                        isReplyOpen: false
                      }],
                      isReplyOpen: false
                    }
                  : reply
              )
            }
          : msg;
      }
      // Add reply to main message
      return msg.id === messageId
        ? {
            ...msg,
            replies: [...msg.replies, {
              id: Date.now(),
              role: 'user',
              content: userMessage,
              username: 'You',
              karma: 1,
              timestamp: new Date().toISOString(),
              upvotes: 0,
              downvotes: 0,
              replies: [],
              isReplyOpen: false
            }],
            isReplyOpen: false
          }
        : msg;
    }));

    // Generate AI response as a reply
    generateResponse(userMessage, messageId, replyId);
  };

  const handleSubmitComment = () => {
    if (!replyText.trim() || isStreaming) return;

    const userMessage = replyText;
    setReplyText('');
    setError(null);
    setIsReplying(false);

    const messageId = Date.now();
    // Add user message
    setMessages(prev => [...prev, {
      id: messageId,
      role: 'user',
      content: userMessage,
      username: 'You',
      karma: 1,
      timestamp: new Date().toISOString(),
      replies: [],
      isReplyOpen: false,
      upvotes: 0,
      downvotes: 0
    }]);

    // Try to generate an initial response
    const tryGenerateInitialResponse = async () => {
      // 50% chance for initial response
      if (Math.random() < 0.5) {
        await generateResponse(userMessage, null, null, false);
      } else {
        // If we skip the initial response, try to get a response from a different persona after a delay
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        await generateResponse(userMessage, null, null, true);
      }
    };

    tryGenerateInitialResponse();
  };

  // Add clearMessages function
  const clearMessages = () => {
    if (window.confirm('Are you sure you want to clear the entire thread? This cannot be undone.')) {
      setMessages([{
        id: 1,
        role: 'assistant',
        content: "Welcome to the thread! Feel free to start a discussion, and one of our community members will respond.",
        username: 'AutoModerator',
        karma: 1000000,
        timestamp: new Date().toISOString(),
        replies: [],
        isReplyOpen: false,
        upvotes: 1,
        downvotes: 0
      }]);
    }
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
          <div className="thread-header">
            <h2>Reddit Thread Simulator</h2>
            <button 
              className="clear-thread-button"
              onClick={clearMessages}
            >
              Clear Thread
            </button>
          </div>
          <div className="thread-info">
            <span className="thread-stats">100% Upvoted</span>
            <span className="thread-stats">•</span>
            <span className="thread-stats">r/ThreadSimulator</span>
          </div>
          
          <div className="add-comment-wrapper">
            <button 
              className="add-comment-button"
              onClick={handleAddComment}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add a comment
            </button>
            
            {isReplying && (
              <div className="reply-input-container">
                <textarea 
                  placeholder="What are your thoughts?"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={isStreaming}
                />
                <div className="reply-actions">
                  <button onClick={() => setIsReplying(false)}>Cancel</button>
                  <button 
                    onClick={handleSubmitComment}
                    disabled={!replyText.trim() || isStreaming}
                  >
                    Comment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`reddit-comment ${message.role}`}>
              <div className="comment-header">
                <div className="comment-user-info">
                  {message.role === 'assistant' && (
                    <img 
                      src={personas.find(p => p.username === message.username)?.imageUrl || '/default-avatar.png'} 
                      alt={`${message.username}'s avatar`}
                      className="comment-avatar"
                    />
                  )}
                  <div className="comment-metadata">
                    <span className="username">u/{message.username}</span>
                    <span className="karma-dot">•</span>
                    <span className="karma">{message.karma} karma</span>
                    <span className="karma-dot">•</span>
                    <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
                  </div>
                </div>
              </div>
              <div className="comment-content">
                {message.content}
                {message.id === messages.length && isStreaming && (
                  <span className="typing-indicator">▊</span>
                )}
              </div>
              <div className="comment-actions">
                <button 
                  className="action-button"
                  onClick={() => handleVote(message.id, true)}
                >
                  <span className="arrow-up">▲</span> {message.upvotes}
                </button>
                <button 
                  className="action-button"
                  onClick={() => handleVote(message.id, false)}
                >
                  <span className="arrow-down">▼</span> {message.downvotes}
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
                  <textarea 
                    placeholder="What are your thoughts?"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={isStreaming}
                  />
                  <div className="reply-actions">
                    <button onClick={() => toggleReply(message.id)}>Cancel</button>
                    <button 
                      onClick={() => handleSubmitReply(message.id)}
                      disabled={!replyText.trim() || isStreaming}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}

              {message.replies.length > 0 && (
                <div className="nested-replies">
                  {message.replies.map(reply => (
                    <div key={reply.id} className={`reddit-comment ${reply.role}`}>
                      <div className="comment-header">
                        <div className="comment-user-info">
                          {reply.role === 'assistant' && (
                            <img 
                              src={personas.find(p => p.username === reply.username)?.imageUrl || '/default-avatar.png'} 
                              alt={`${reply.username}'s avatar`}
                              className="comment-avatar"
                            />
                          )}
                          <div className="comment-metadata">
                            <span className="username">u/{reply.username}</span>
                            <span className="karma-dot">•</span>
                            <span className="karma">{reply.karma} karma</span>
                            <span className="karma-dot">•</span>
                            <span className="timestamp">{formatTimestamp(reply.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="comment-content">
                        {reply.content}
                      </div>
                      <div className="comment-actions">
                        <button 
                          className="action-button"
                          onClick={() => handleVote(reply.id, true, true, message.id)}
                        >
                          <span className="arrow-up">▲</span> {reply.upvotes}
                        </button>
                        <button 
                          className="action-button"
                          onClick={() => handleVote(reply.id, false, true, message.id)}
                        >
                          <span className="arrow-down">▼</span> {reply.downvotes}
                        </button>
                        <button 
                          className="action-button"
                          onClick={() => toggleReply(message.id, reply.id)}
                        >
                          Reply
                        </button>
                        <button className="action-button">Share</button>
                        <button className="action-button">Report</button>
                      </div>

                      {reply.isReplyOpen && (
                        <div className="reply-form">
                          <textarea 
                            placeholder="What are your thoughts?"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            disabled={isStreaming}
                          />
                          <div className="reply-actions">
                            <button onClick={() => toggleReply(message.id, reply.id)}>Cancel</button>
                            <button 
                              onClick={() => handleSubmitReply(message.id, reply.id)}
                              disabled={!replyText.trim() || isStreaming}
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Render nested replies */}
                      {reply.replies && reply.replies.length > 0 && (
                        <div className="nested-replies">
                          {reply.replies.map(nestedReply => (
                            <div key={nestedReply.id} className={`reddit-comment ${nestedReply.role}`}>
                              <div className="comment-header">
                                <div className="comment-user-info">
                                  {nestedReply.role === 'assistant' && (
                                    <img 
                                      src={personas.find(p => p.username === nestedReply.username)?.imageUrl || '/default-avatar.png'} 
                                      alt={`${nestedReply.username}'s avatar`}
                                      className="comment-avatar"
                                    />
                                  )}
                                  <div className="comment-metadata">
                                    <span className="username">u/{nestedReply.username}</span>
                                    <span className="karma-dot">•</span>
                                    <span className="karma">{nestedReply.karma} karma</span>
                                    <span className="karma-dot">•</span>
                                    <span className="timestamp">{formatTimestamp(nestedReply.timestamp)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="comment-content">
                                {nestedReply.content}
                              </div>
                              <div className="comment-actions">
                                <button className="action-button">
                                  <span className="arrow-up">▲</span> {nestedReply.upvotes}
                                </button>
                                <button className="action-button">
                                  <span className="arrow-down">▼</span> {nestedReply.downvotes}
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
      </div>
      {generatingPersona && (
        <div className="status-popup">
          <div className="spinner" />
          <span>u/{generatingPersona.username} is typing...</span>
        </div>
      )}
    </div>
  );
}

export default Chat; 
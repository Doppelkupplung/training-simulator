import React, { useState, useEffect, useRef } from 'react';
import { Together } from 'together-ai';
import config from '../config';
import './Chat.css';
import CommentInput from './CommentInput';
import './CommentInput.css';
import UserInfoPopup from './UserInfoPopup';
import ThreadSearch from './ThreadSearch';

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

const getMessageChain = (messages, messageId, replyId = null) => {
  const chain = [];
  
  // Find the target message and its chain of replies
  const findMessage = (msgs, targetId) => {
    for (const msg of msgs) {
      if (msg.id === targetId) {
        return msg;
      }
      if (msg.replies) {
        const found = findMessage(msg.replies, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  // Get the main message
  const mainMessage = findMessage(messages, messageId);
  if (!mainMessage) return chain;

  chain.push(mainMessage);

  // If we have a replyId, find that specific reply chain
  if (replyId) {
    const findReplyChain = (replies, targetId) => {
      for (const reply of replies) {
        if (reply.id === targetId) {
          chain.push(reply);
          // Add any nested replies
          if (reply.replies) {
            chain.push(...reply.replies);
          }
          return true;
        }
      }
      return false;
    };

    if (mainMessage.replies) {
      findReplyChain(mainMessage.replies, replyId);
    }
  } else {
    // Add all replies in the chain
    if (mainMessage.replies) {
      chain.push(...mainMessage.replies);
    }
  }

  return chain;
};

const selectNextPersona = async (userMessage, personas, messageChain, aiResponseCount, currentThread) => {
  try {
    // Get the last few participants in order, but only from the current thread
    const recentParticipants = messageChain
      .filter(msg => msg.role === 'assistant' && msg.username !== 'AutoModerator')
      .map(msg => msg.username)
      .reverse()
      .slice(0, 3);

    console.log('\n=== Persona Selection Debug ===');
    console.log('Recent participants in current thread:', recentParticipants);
    
    // Filter out personas that shouldn't participate
    const availablePersonas = personas.filter(p => 
      // Don't allow the most recent responder in this thread to reply
      p.username !== recentParticipants[0] &&
      // Don't allow AutoModerator in conversations
      p.username !== 'AutoModerator' &&
      // Don't allow the user as a persona
      p.username !== 'You'
    );

    console.log('Available personas after filtering:', availablePersonas.map(p => p.username));

    if (availablePersonas.length === 0) {
      console.log('No available personas after filtering');
      return null;
    }

    // Format recent messages for context
    const recentMessages = messageChain
      .slice(-3)
      .map(msg => `u/${msg.username}: ${msg.content}`)
      .join('\n');

    // Create the analysis prompt with thread context
    const analysisPrompt = `You are a conversation analyzer. Your task is to select the most appropriate Reddit user to respond to a message in a thread.

Thread Context:
Subreddit: r/${currentThread.subreddit}
Title: "${currentThread.title}"
Description: "${currentThread.description}"

Recent conversation in this thread:
${recentMessages}

New message to analyze: "${userMessage}"

Available personas (ONLY select from these - these are the only valid options):
${availablePersonas.map((p, i) => `
${i + 1}. Username: ${p.username}
   Interests & Expertise: ${p.interests}`).join('\n')}

Instructions:
1. Analyze the conversation flow and topic
2. Select a persona whose interests and expertise match the discussion topic and thread context
3. IMPORTANT: You MUST select from the available personas listed above
4. Consider conversation continuity but prioritize topic relevance and expertise
5. Avoid selecting personas who have recently participated in this thread

Format your response EXACTLY like this:
Selected Persona: [number]
Topic: [main topic of discussion]
Reasoning: [2-3 sentences explaining the selection]

End your response with ONLY the number on the last line.`;

    const response = await together.chat.completions.create({
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a conversation analyzer that selects the most relevant persona based on topic matching and conversation flow.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
    });

    const fullResponse = response.choices[0].message.content;
    console.log('LLM Response:', fullResponse);

    // Parse the response to get the selected persona index
    const lines = fullResponse.split('\n').filter(line => line.trim());
    let selectedIndex = -1;

    // Try to find the index in the Selected Persona line
    const selectedPersonaLine = lines.find(line => line.startsWith('Selected Persona:'));
    if (selectedPersonaLine) {
      const match = selectedPersonaLine.match(/Selected Persona:\s*(\d+)/);
      if (match) {
        selectedIndex = parseInt(match[1]) - 1;
      }
    }

    // If not found, check the last line
    if (selectedIndex === -1) {
      const lastLine = lines[lines.length - 1].trim();
      if (/^\d+$/.test(lastLine)) {
        selectedIndex = parseInt(lastLine) - 1;
      }
    }

    if (selectedIndex >= 0 && selectedIndex < availablePersonas.length) {
      const selectedPersona = availablePersonas[selectedIndex];
      console.log('Selected:', selectedPersona.username);
      console.log('===============================\n');
      return selectedPersona;
    }

    return availablePersonas[0]; // Fallback to first available persona
  } catch (error) {
    console.error('Error selecting persona:', error);
    return null; // Return null instead of undefined availablePersonas
  }
};

const STORAGE_KEY = 'reddit_simulator_messages';
const THREADS_STORAGE_KEY = 'reddit_threads';

const countTotalMessages = (messages) => {
  let total = 0;
  
  const countReplies = (replies) => {
    if (!replies) return 0;
    let count = replies.length;
    for (const reply of replies) {
      if (reply.replies) {
        count += countReplies(reply.replies);
      }
    }
    return count;
  };

  // Count top-level messages (excluding the AutoModerator welcome message)
  total = messages.filter(msg => msg.username !== 'AutoModerator').length;
  
  // Add all replies
  for (const message of messages) {
    total += countReplies(message.replies);
  }
  
  return total;
};

const formatMessageWithMentions = (content, personas, onShowUserInfo) => {
  // Create a regex pattern that matches @username mentions
  const mentionPattern = new RegExp(`@(${personas.map(p => p.username).join('|')})\\b`, 'g');
  
  // Split the content by mentions and map each part
  const parts = content.split(mentionPattern);
  
  return parts.map((part, index) => {
    // Check if this username exists in personas
    const isUsername = personas.some(p => p.username === part);
    
    if (isUsername) {
      const handleMouseEnter = (e) => {
        const rect = e.target.getBoundingClientRect();
        onShowUserInfo(part, {
          x: rect.left,
          y: rect.bottom + 8
        });
      };

      return (
        <span
          key={index}
          className="user-mention"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => onShowUserInfo(null)}
        >
          @{part}
        </span>
      );
    }
    return part;
  });
};

function Chat({ personas }) {
  const [currentThread, setCurrentThread] = useState({
    id: 'default',
    subreddit: 'townhall',
    title: 'Town Hall',
    description: 'Welcome to the Town Hall! This is a place for open discussion and community dialogue. Feel free to share your thoughts, ask questions, or start a conversation on any topic.',
    createdAt: new Date().toISOString()
  });

  const [messages, setMessages] = useState(() => {
    // Try to load messages from localStorage for the current thread
    const savedMessages = localStorage.getItem(`${STORAGE_KEY}_${currentThread.id}`);
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

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(initError);
  const [generatingPersona, setGeneratingPersona] = useState(null);
  const messagesEndRef = useRef(null);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [hoveredUser, setHoveredUser] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState([]);

  // Add event listener for thread cleared event
  useEffect(() => {
    const handleThreadCleared = (event) => {
      const { threadId } = event.detail;
      if (threadId === currentThread.id) {
        // Reset messages to default state
        const defaultMessage = {
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
        };
        setMessages([defaultMessage]);
      }
    };

    window.addEventListener('threadCleared', handleThreadCleared);
    return () => window.removeEventListener('threadCleared', handleThreadCleared);
  }, [currentThread.id]);

  // Save messages to localStorage whenever they change, using thread-specific key
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_${currentThread.id}`, JSON.stringify(messages));
  }, [messages, currentThread.id]);

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

    // Add setTimeout to wait for the reply form to be rendered
    setTimeout(() => {
      const replyForm = document.querySelector(`[data-message-id="${messageId}"] .reply-form`);
      if (replyForm) {
        replyForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleVote = (messageId, isUpvote, isReply = false, parentId = null) => {
    setMessages(prev => {
      if (isReply) {
        return prev.map(msg => {
          if (msg.id === parentId) {
            // Helper function to update votes in nested replies
            const updateRepliesVotes = (replies) => {
              return replies.map(reply => {
                if (reply.id === messageId) {
                  return {
                    ...reply,
                    upvotes: isUpvote ? reply.upvotes + 1 : reply.upvotes,
                    downvotes: !isUpvote ? reply.downvotes + 1 : reply.downvotes
                  };
                }
                // If this reply has nested replies, recursively update them
                if (reply.replies && reply.replies.length > 0) {
                  return {
                    ...reply,
                    replies: updateRepliesVotes(reply.replies)
                  };
                }
                return reply;
              });
            };

            return {
              ...msg,
              replies: updateRepliesVotes(msg.replies)
            };
          }
          return msg;
        });
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

    // More sophisticated check for user-directed messages
    const isDirectedAtUser = (() => {
      const message = messageContent.toLowerCase();
      
      // Check for direct mentions
      if (message.includes('@you') || message.includes('u/you')) return true;
      
      // Check for question patterns directed at 'you'
      const questionPatterns = [
        /\b(what|how|why|when|where|who|could|would|do|are|can|will)\s+(you|your)\b/i,
        /\b(you|your)\s+(think|believe|opinion|thoughts|view|take|perspective)\b/i
      ];
      if (questionPatterns.some(pattern => pattern.test(message))) return true;
      
      // Check for imperative sentences directed at 'you'
      const imperativePatterns = [
        /^(please|pls|kindly|hey)\s+(you|your)\b/i,
        /\b(tell|let|give|share|help|explain)\s+(me|us)\b/i,
        /\b(can|could)\s+you\s+(please|pls)?\b/i
      ];
      if (imperativePatterns.some(pattern => pattern.test(message))) return true;
      
      // Check for direct addressing
      const addressingPatterns = [
        /^(hey|hi|hello|dear)\s+(you|user)\b/i,
        /\b(asking|directed at|meant for)\s+(you|the user)\b/i
      ];
      if (addressingPatterns.some(pattern => pattern.test(message))) return true;
      
      return false;
    })();
    
    if (isDirectedAtUser) {
      console.log('Message is directed at user, skipping random reply');
      return;
    }

    console.log('\n=== Random Reply Generation Debug ===');
    console.log('Current AI Response Count:', aiResponseCount);
    console.log('Message ID:', messageId);
    console.log('Parent ID:', parentId);

    // Check nesting level before proceeding
    const currentNestLevel = getNestingLevel(parentId, messageId);
    console.log('Current Nesting Level:', currentNestLevel);
    
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
          targetMessageId = messageId;
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

      console.log('Last Responder:', lastResponderUsername);
      console.log('Immediate Parent:', immediateParentUsername);
      
      // Filter out only the last responder to prevent self-replies but allow conversation
      const availablePersonas = personas.filter(p => 
        p.username !== lastResponderUsername && // Don't allow same persona to reply to itself
        p.username !== 'AutoModerator' && // Don't include AutoModerator in random replies
        p.username !== 'You' // Don't include user in random replies
      );

      // Double-check that we have available personas after filtering
      if (availablePersonas.length === 0) {
        console.log('No available personas after filtering');
        return;
      }

      console.log('Available Personas for Reply:', availablePersonas.map(p => p.username));
      
      // 70% chance to generate a reply if we have available personas
      const shouldReply = Math.random() < 0.7;
      console.log('Should Generate Reply:', shouldReply);
      
      if (shouldReply) {
        // Wait a random time between 2-5 seconds before starting the reply
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        
        // Create a prompt that references the previous message and encourages engagement
        const replyPrompt = `You are participating in a thread on r/politics titled "2024 election thoughts?" about the upcoming election.
The thread asks: "What are your thoughts on the upcoming 2024 election? Looking to hear different perspectives on key issues, candidates, and potential outcomes."

Reply to this message in a way that encourages further discussion while staying relevant to the election topic: "${messageContent}"`;
        
        // Generate a reply with the correct parent ID and increment the AI response count
        if (targetParentId) {
          // If we have a parentId, this is a nested reply
          generateResponse(replyPrompt, targetParentId, targetMessageId, true, aiResponseCount + 1);
        } else {
          // This is a direct reply to the message
          generateResponse(replyPrompt, targetMessageId, null, true, aiResponseCount + 1);
        }
      } else {
        console.log('Skipping reply generation due to random chance');
      }
    }
    console.log('===============================\n');
  };

  const generateResponse = async (userMessage, parentId = null, replyToReplyId = null, isRandomReply = false, aiResponseCount = 1) => {
    if (!together) {
      const errorMessage = 'Chat service is not available. Please check your API key configuration.';
      console.error(errorMessage);
      setError(errorMessage);
      return;
    }

    // Check if we've reached the maximum AI response chain
    if (isRandomReply && aiResponseCount >= 2) {
      console.log('Reached maximum AI response chain (2), stopping');
      return;
    }

    let targetParentId = parentId;
    let targetReplyToReplyId = replyToReplyId;

    try {
      setIsStreaming(true);
      setError(null);

      // Get the full message chain for context, but only from the current thread
      const messageChain = getMessageChain(messages, parentId, replyToReplyId);
      
      // Select the next persona to respond with current thread context
      const selectedPersona = await selectNextPersona(userMessage, personas, messageChain, aiResponseCount, currentThread);
      if (!selectedPersona) {
        console.log('No suitable persona available');
        return;
      }

      setGeneratingPersona(selectedPersona);

      // Get the message being replied to
      let messageToVoteOn = null;

      // If we're replying to a nested reply
      if (targetReplyToReplyId && targetParentId) {
        const parentMessage = messages.find(m => m.id === targetParentId);
        if (parentMessage?.replies) {
          const targetReply = parentMessage.replies.find(r => r.id === targetReplyToReplyId);
          if (targetReply) {
            messageToVoteOn = {
              id: targetReplyToReplyId,
              content: targetReply.content,
              parentId: targetParentId,
              isReply: true
            };
          }
        }
      }
      // If we're replying to a direct reply or main message
      else if (targetParentId) {
        const parentMessage = messages.find(m => m.id === targetParentId);
        if (parentMessage) {
          messageToVoteOn = {
            id: targetParentId,
            content: parentMessage.content,
            isReply: false
          };
        }
      }

      // Perform sentiment analysis and voting if we have a target message
      if (messageToVoteOn) {
        console.log('Analyzing sentiment for message:', {
          id: messageToVoteOn.id,
          content: messageToVoteOn.content,
          isReply: messageToVoteOn.isReply,
          parentId: messageToVoteOn.parentId
        });
        
        const sentimentPrompt = `You are analyzing the sentiment of this message: "${messageToVoteOn.content}"
Based on your personality and interests, would you upvote or downvote this message?
Consider factors like:
- Agreement/disagreement with the message
- Quality of the content
- Relevance to your interests
- Tone and style

Respond with EXACTLY one word: either "upvote" or "downvote"`;

        const sentimentResponse = await together.chat.completions.create({
          model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
          messages: [
            {
              role: 'system',
              content: `You are roleplaying as a Reddit user with the following profile:
Username: ${selectedPersona.username}
Personality: ${selectedPersona.personality}
Interests: ${selectedPersona.interests}
Writing Style: ${selectedPersona.writingStyle}

You are in r/${currentThread.subreddit} responding to a thread titled "${currentThread.title}"`
            },
            {
              role: 'user',
              content: sentimentPrompt
            }
          ],
          temperature: 0.7,
        });

        const sentiment = sentimentResponse.choices[0].message.content.trim().toLowerCase();
        const isUpvote = sentiment === 'upvote';

        console.log('Vote decision:', {
          messageId: messageToVoteOn.id,
          sentiment,
          isUpvote,
          isReply: messageToVoteOn.isReply,
          parentId: messageToVoteOn.parentId,
          persona: selectedPersona.username
        });

        // Vote on the message
        if (messageToVoteOn.isReply) {
          console.log('Voting on reply:', {
            replyId: messageToVoteOn.id,
            parentId: messageToVoteOn.parentId,
            isUpvote
          });
          handleVote(messageToVoteOn.id, isUpvote, true, messageToVoteOn.parentId);
        } else {
          console.log('Voting on main message:', {
            messageId: messageToVoteOn.id,
            isUpvote
          });
          handleVote(messageToVoteOn.id, isUpvote);
        }
      }

      const systemPrompt = `You are roleplaying as a Reddit user with the following profile:
Username: ${selectedPersona.username}
Karma: ${selectedPersona.karma}
Personality: ${selectedPersona.personality}
Interests: ${selectedPersona.interests}
Writing Style: ${selectedPersona.writingStyle}

You are participating in a thread on r/${currentThread.subreddit} titled "${currentThread.title}" with the following description:
"${currentThread.description}"

Respond to the conversation in character, maintaining consistency with your profile's personality and writing style. Use Reddit terminology where appropriate. Your response should reflect your interests and expertise while staying relevant to the thread topic.`;

      // Use the message chain for context, but only from the current thread
      const chatMessages = messageChain.map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      }));

      console.log('Generating response for:', userMessage);
      console.log('Current thread context:', {
        subreddit: currentThread.subreddit,
        title: currentThread.title,
        description: currentThread.description
      });

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
        // Check if we're at the maximum nesting level (level 3)
        const nestingLevel = getNestingLevel(targetParentId, targetReplyToReplyId);
        
        if (nestingLevel >= 3) {
          // At max nesting level, add the reply as a sibling to the current reply
          setMessages(prev => prev.map(msg =>
            msg.id === targetParentId
              ? {
                  ...msg,
                  replies: [
                    ...msg.replies,
                    {
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
                    }
                  ]
                }
              : msg
          ));
        } else {
          // For level 2 replies, nest them normally
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
        }

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

    // Generate AI response as a reply starting with aiResponseCount of 0 since this is user-initiated
    generateResponse(userMessage, messageId, replyId, false, 0);
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

    // Try to generate an initial response with aiResponseCount starting at 0
    const tryGenerateInitialResponse = async () => {
      // 50% chance for initial response
      if (Math.random() < 0.5) {
        await generateResponse(userMessage, null, null, false, 0);
      } else {
        // If we skip the initial response, try to get a response from a different persona after a delay
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        await generateResponse(userMessage, null, null, true, 0);
      }
    };

    tryGenerateInitialResponse();
  };

  // Add clearMessages function
  const clearMessages = () => {
    if (window.confirm('Are you sure you want to clear this thread? This cannot be undone.')) {
      const defaultMessage = {
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
      };
      setMessages([defaultMessage]);
      // Clear only the current thread's messages from localStorage
      localStorage.removeItem(`${STORAGE_KEY}_${currentThread.id}`);
      // Save the default message for the current thread
      localStorage.setItem(`${STORAGE_KEY}_${currentThread.id}`, JSON.stringify([defaultMessage]));
    }
  };

  const handleShowUserInfo = (username, position) => {
    if (username) {
      const user = personas.find(p => p.username === username);
      if (user) {
        // Find the latest message or reply from this user
        let latestTimestamp = null;
        
        // Helper function to check messages and their replies
        const findLatestTimestamp = (items) => {
          items.forEach(item => {
            if (item.username === username) {
              const timestamp = new Date(item.timestamp);
              if (!latestTimestamp || timestamp > latestTimestamp) {
                latestTimestamp = timestamp;
              }
            }
            // Check replies
            if (item.replies) {
              findLatestTimestamp(item.replies);
            }
          });
        };

        // Search through all messages and their replies
        findLatestTimestamp(messages);

        setHoveredUser({
          ...user,
          timestamp: latestTimestamp ? latestTimestamp.toISOString() : new Date().toISOString()
        });
        setPopupPosition(position);
      }
    } else {
      setHoveredUser(null);
    }
  };

  // Add useEffect for filtering messages based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMessages(messages);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = messages.filter(message => {
      const matchesContent = message.content.toLowerCase().includes(query);
      const matchesUsername = message.username.toLowerCase().includes(query);
      
      // Also search in replies
      const hasMatchingReplies = message.replies.some(reply => 
        reply.content.toLowerCase().includes(query) ||
        reply.username.toLowerCase().includes(query)
      );

      return matchesContent || matchesUsername || hasMatchingReplies;
    });

    setFilteredMessages(filtered);
  }, [searchQuery, messages]);

  const handleThreadSelect = (thread) => {
    setCurrentThread(thread);
    // Load messages for the selected thread
    const savedMessages = localStorage.getItem(`${STORAGE_KEY}_${thread.id}`);
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error('Failed to load messages for thread:', e);
        // Fall back to default initial message
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
    } else {
      // No saved messages for this thread, set default initial message
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
    setFilteredMessages([]);
    setSearchQuery('');
  };

  // Add useEffect to update thread's comment count
  useEffect(() => {
    // Skip if it's the default thread
    if (currentThread.id === 'default') return;

    // Get current threads
    const savedThreads = localStorage.getItem(THREADS_STORAGE_KEY);
    if (savedThreads) {
      try {
        const threads = JSON.parse(savedThreads);
        const updatedThreads = threads.map(thread => {
          if (thread.id === currentThread.id) {
            return {
              ...thread,
              comments: countTotalMessages(messages)
            };
          }
          return thread;
        });
        localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(updatedThreads));
      } catch (e) {
        console.error('Failed to update thread comment count:', e);
      }
    }
  }, [messages, currentThread.id]);

  return (
    <div style={{ 
      margin: 0,
      padding: 0,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="chat-container">
        <ThreadSearch 
          onSearch={setSearchQuery} 
          onThreadSelect={handleThreadSelect}
        />
        <div className="scrollable-area">
          <div className="thread-title">
            <div className="thread-header">
              <div className="subreddit-info">
                <span className="subreddit">r/{currentThread.subreddit}</span>
                <span className="dot">•</span>
                <span className="post-time">{formatTimestamp(currentThread.createdAt)}</span>
              </div>
              <button 
                className="clear-thread-button"
                onClick={clearMessages}
              >
                Clear Thread
              </button>
            </div>
            <h2>{currentThread.title}</h2>
            <div className="post-description">
              {currentThread.description}
            </div>
            <div className="thread-info">
              <span className="thread-stats">100% Upvoted</span>
              <span className="thread-stats">•</span>
              <span className="thread-stats">r/{currentThread.subreddit}</span>
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
                  <CommentInput
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={isStreaming}
                    personas={personas}
                    onSubmit={handleSubmitComment}
                    onCancel={() => setIsReplying(false)}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="chat-messages">
            {filteredMessages.map((message) => (
              <div 
                key={message.id} 
                className={`reddit-comment ${message.role}`}
                data-message-id={message.id}
              >
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
                      <span 
                        className="username"
                        onMouseEnter={(e) => {
                          const rect = e.target.getBoundingClientRect();
                          handleShowUserInfo(message.username, {
                            x: rect.left,
                            y: rect.bottom + 8
                          });
                        }}
                        onMouseLeave={() => handleShowUserInfo(null)}
                      >u/{message.username}</span>
                      <span className="karma-dot">•</span>
                      <span className="karma">{message.karma} karma</span>
                      <span className="karma-dot">•</span>
                      <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <div className="comment-content">
                  {formatMessageWithMentions(message.content, personas, handleShowUserInfo)}
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
                    <CommentInput
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      disabled={isStreaming}
                      personas={personas}
                      onSubmit={() => handleSubmitReply(message.id)}
                      onCancel={() => toggleReply(message.id)}
                    />
                  </div>
                )}

                {message.replies.length > 0 && (
                  <div className="nested-replies">
                    {message.replies.map(reply => (
                      <div 
                        key={reply.id} 
                        className={`reddit-comment ${reply.role}`}
                        data-message-id={reply.id}
                      >
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
                              <span 
                                className="username"
                                onMouseEnter={(e) => {
                                  const rect = e.target.getBoundingClientRect();
                                  handleShowUserInfo(reply.username, {
                                    x: rect.left,
                                    y: rect.bottom + 8
                                  });
                                }}
                                onMouseLeave={() => handleShowUserInfo(null)}
                              >u/{reply.username}</span>
                              <span className="karma-dot">•</span>
                              <span className="karma">{reply.karma} karma</span>
                              <span className="karma-dot">•</span>
                              <span className="timestamp">{formatTimestamp(reply.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="comment-content">
                          {formatMessageWithMentions(reply.content, personas, handleShowUserInfo)}
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
                            <CommentInput
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              disabled={isStreaming}
                              personas={personas}
                              onSubmit={() => handleSubmitReply(message.id, reply.id)}
                              onCancel={() => toggleReply(message.id, reply.id)}
                            />
                          </div>
                        )}

                        {/* Render nested replies */}
                        {reply.replies && reply.replies.length > 0 && (
                          <div className="nested-replies">
                            {reply.replies.map(nestedReply => (
                              <div 
                                key={nestedReply.id} 
                                className={`reddit-comment ${nestedReply.role}`}
                                data-message-id={nestedReply.id}
                              >
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
                                      <span 
                                        className="username"
                                        onMouseEnter={(e) => {
                                          const rect = e.target.getBoundingClientRect();
                                          handleShowUserInfo(nestedReply.username, {
                                            x: rect.left,
                                            y: rect.bottom + 8
                                          });
                                        }}
                                        onMouseLeave={() => handleShowUserInfo(null)}
                                      >u/{nestedReply.username}</span>
                                      <span className="karma-dot">•</span>
                                      <span className="karma">{nestedReply.karma} karma</span>
                                      <span className="karma-dot">•</span>
                                      <span className="timestamp">{formatTimestamp(nestedReply.timestamp)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="comment-content">
                                  {formatMessageWithMentions(nestedReply.content, personas, handleShowUserInfo)}
                                </div>
                                <div className="comment-actions">
                                  <button 
                                    className="action-button"
                                    onClick={() => handleVote(nestedReply.id, true, true, message.id)}
                                  >
                                    <span className="arrow-up">▲</span> {nestedReply.upvotes}
                                  </button>
                                  <button 
                                    className="action-button"
                                    onClick={() => handleVote(nestedReply.id, false, true, message.id)}
                                  >
                                    <span className="arrow-down">▼</span> {nestedReply.downvotes}
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
      </div>
      {hoveredUser && (
        <UserInfoPopup
          user={hoveredUser}
          position={popupPosition}
        />
      )}
      {generatingPersona && (
        <div className="status-popup">
          <div className="spinner" />
          <span>Someone is typing...</span>
        </div>
      )}
    </div>
  );
}

export default Chat; 
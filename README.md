# Reddit Chat Simulator

A sophisticated React application that simulates Reddit-style conversations using AI-powered personas. Practice and observe realistic Reddit interactions in a controlled environment.

## 🌟 Key Features

### 🤖 AI-Powered Persona Generation
- Automatically generates unique Reddit user personas using Meta's Llama 3.1 model
- Each persona includes:
  - Distinct personality traits
  - Specific interests and expertise
  - Characteristic writing style
- Powered by Together AI's API integration

### 💬 Dynamic Conversation Simulation
- Real-time chat interactions with AI personas
- Context-aware responses that maintain conversation coherence
- Support for nested comment threads
- Username mentions and interactions between AI personas

### 🎭 Persona Management
- Create, edit, and delete Reddit user personas
- Manual persona creation with customizable traits
- Random persona generation using LLM
- Persistent storage of personas

### 📝 Thread Building
- Create custom Reddit-style discussion threads
- Configurable subreddit contexts
- Upvote/downvote simulation
- Timestamp tracking and formatting

## 🔧 Technical Implementation

### LLM Integration
The application uses Together AI's API with Meta's Llama 3.1 model for:

1. **Persona Generation**
- Generates unique personas with distinct personalities, interests, and writing styles
- Uses Together AI's API to create personas
- Persona data is stored in the `personas` state

2. **Chat Response Generation**
- Maintains conversation context
- Generates responses based on persona characteristics
- Handles complex thread structures

### Key Components
- `PersonaBuilder`: Manages AI persona creation and customization
- `Chat`: Handles conversation flow and LLM interactions
- `ThreadBuilder`: Creates and manages discussion contexts
- `CommentInput`: Handles user interactions and mentions

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies:
- `npm install`
3. Set up API keys:
- Create a `.env` file in the root directory with the following:
  - `REACT_APP_TOGETHER_API_KEY=<your_api_key>`
4. Run the development server:
- `npm start`



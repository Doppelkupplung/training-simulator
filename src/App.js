import React from 'react';
import './App.css';
import Navbar from './components/Navbar';
import Chat from './components/Chat';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  console.log('App component rendering');
  
  return (
    <ErrorBoundary>
      <div className="App">
        <Navbar />
        <Chat />
      </div>
    </ErrorBoundary>
  );
}

export default App;

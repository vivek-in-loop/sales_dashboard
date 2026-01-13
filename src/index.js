import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Suppress Cross-Origin-Opener-Policy (COOP) warnings from Google OAuth
// These are harmless warnings that occur when Google's OAuth library tries to check
// if a popup window is closed, but the browser's COOP policy prevents this check.
// They don't affect functionality.
const originalError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString() || '';
  // Filter out COOP-related warnings from Google OAuth
  if (message.includes('Cross-Origin-Opener-Policy') || 
      message.includes('window.closed')) {
    return; // Suppress these warnings
  }
  // Allow all other errors through
  originalError.apply(console, args);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

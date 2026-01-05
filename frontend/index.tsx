import React from 'react';
import ReactDOM from 'react-dom/client';

// Polyfill for Object.hasOwn (ES2022) for older environments
if (!Object.hasOwn) {
  // @ts-ignore
  Object.hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
}

import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
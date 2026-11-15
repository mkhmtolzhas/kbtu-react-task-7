import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { registerServiceWorker } from './pwa/registerSW.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/auth.css';
import './styles/pwa.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registered at module scope, not inside an effect: StrictMode mounts components
// twice, and registering twice means two update listeners and a reload race.
registerServiceWorker();

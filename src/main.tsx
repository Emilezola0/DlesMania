import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { startCloudIfNeeded } from './cloud/state';
import './index.css';

// Signed in on this device before (or back from a sign-in link): keep the save in step with the account.
startCloudIfNeeded();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

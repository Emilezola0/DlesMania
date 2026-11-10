import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { startCloudIfNeeded } from './cloud/state';
import { keepClockSynced } from './lib/date';
import { askWikiPicturesWithoutReferrer } from './lib/wikiImages';
import './index.css';

// Before anything renders: the fan wikis' pictures only load when asked without a referrer.
askWikiPicturesWithoutReferrer();

// Signed in on this device before (or back from a sign-in link): keep the save in step with the account.
startCloudIfNeeded();

// The real time first (a moment at most): "today", and what can be earned today, follow the server's clock.
void keepClockSynced().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  ),
);

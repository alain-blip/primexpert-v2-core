/**
 * Montage React workhub — importé uniquement depuis index.html sur /workhub et /acces-vendeur.
 */

import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const staticLanding = document.getElementById('primexpert-static-landing');
const rootEl = document.getElementById('root');

document.body.classList.add('px-spa');
if (staticLanding) staticLanding.style.display = 'none';
if (rootEl) rootEl.style.display = 'block';

createRoot(rootEl!).render(<App />);

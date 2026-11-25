import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/app.css';
import { App } from './ui/App';

// Block the browser context menu / reload shortcuts that feel out of place in a desktop app.
document.addEventListener('contextmenu', e => { if (!(e.target as HTMLElement).closest('input')) e.preventDefault(); });

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

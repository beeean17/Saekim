import React from 'react';
import ReactDOM from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles/tokens.css';
import './styles/themes/default.css';
import './styles/themes/dark.css';
import './styles/themes/nord.css';
import './styles/globals.css';
import './styles/app.css';
import './styles/preview.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

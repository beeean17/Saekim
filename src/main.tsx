import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/ibm-plex-sans-kr/latin-400.css';
import '@fontsource/ibm-plex-sans-kr/latin-500.css';
import '@fontsource/ibm-plex-sans-kr/latin-600.css';
import '@fontsource/ibm-plex-sans-kr/latin-700.css';
import '@fontsource/ibm-plex-sans-kr/korean-400.css';
import '@fontsource/ibm-plex-sans-kr/korean-500.css';
import '@fontsource/ibm-plex-sans-kr/korean-600.css';
import '@fontsource/ibm-plex-sans-kr/korean-700.css';
import 'katex/dist/katex.min.css';
import './styles/tokens.css';
import './styles/themes/default.css';
import './styles/themes/dark.css';
import './styles/themes/nord.css';
import './styles/globals.css';
import './styles/app.css';
import './styles/preview.css';
import './styles/print.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './components/ui/toast';
import { TooltipProvider } from './components/ui/tooltip';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>
);

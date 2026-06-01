import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent standard ResizeObserver errors from triggering the Vite/browser error overlay
if (typeof window !== 'undefined') {
  const resizeObserverErrorHandler = (e: ErrorEvent) => {
    if (
      e.message === 'ResizeObserver loop limit exceeded' ||
      e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
      e.message?.includes('ResizeObserver')
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };

  const handleRejection = (e: PromiseRejectionEvent) => {
    if (
      e.reason?.message?.includes('ResizeObserver') ||
      e.reason?.toString()?.includes('ResizeObserver')
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };

  window.addEventListener('error', resizeObserverErrorHandler);
  window.addEventListener('unhandledrejection', handleRejection);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

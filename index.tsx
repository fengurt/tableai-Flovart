
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate, AuthProviderRoot } from './components/AuthGate';
import { logtoConfig } from './services/deploymentConfig';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const authConfig = logtoConfig();

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProviderRoot config={authConfig}>
        <AuthGate configured={!!authConfig}>
          <App authConfigured={!!authConfig} />
        </AuthGate>
      </AuthProviderRoot>
    </ErrorBoundary>
  </React.StrictMode>
);

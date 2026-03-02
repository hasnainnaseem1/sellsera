import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { PermissionProvider } from './contexts/PermissionContext';
import reportWebVitals from './reportWebVitals';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ConfigProvider theme={{ token: { colorPrimary: '#722ed1' } }}>
      <AntApp>
        <AuthProvider>
          <PermissionProvider>
            <App />
          </PermissionProvider>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);

reportWebVitals();

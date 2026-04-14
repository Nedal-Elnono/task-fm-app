import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminDashboard } from './pages/AdminDashboard';
import './styles/dashboard.css';

ReactDOM.createRoot(document.getElementById('dashboard-root')!).render(
  <React.StrictMode>
    <AdminDashboard />
  </React.StrictMode>
);

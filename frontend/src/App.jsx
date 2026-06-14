import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import GroupDetail from './views/GroupDetail';
import ExpenseDetail from './views/ExpenseDetail';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('login'); // login, dashboard, group, expense
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [activeExpenseId, setActiveExpenseId] = useState(null);
  const [activeGroupCurrency, setActiveGroupCurrency] = useState('INR');



  // Host URL helper
  const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;

  // Run initial authentication check on load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        setCurrentView('login');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Session expired');
        }

        const userData = await response.json();
        setUser(userData);
        setCurrentView('dashboard');
      } catch (error) {
        console.error('Auth verification error:', error);
        localStorage.removeItem('token');
        setCurrentView('login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCurrentView('login');
    setActiveGroupId(null);
    setActiveExpenseId(null);
  };

  const handleSelectGroup = (groupId) => {
    setActiveGroupId(groupId);
    setCurrentView('group');
  };

  const handleSelectExpense = (expenseId, currencySymbol = 'INR') => {
    setActiveExpenseId(expenseId);
    setActiveGroupCurrency(currencySymbol);
    setCurrentView('expense');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fcfbfa', color: '#1c1917', fontFamily: 'sans-serif' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0,0,0,0.05)', borderTop: '3px solid #0f766e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', fontSize: '14px', color: '#78716c', fontWeight: '500' }}>Initializing HisabKitab...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
      />
      
      <div className="main-content">
        {currentView === 'login' && (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}
        
        {currentView === 'dashboard' && user && (
          <Dashboard 
            user={user} 
            onSelectGroup={handleSelectGroup} 
          />
        )}
        
        {currentView === 'group' && user && activeGroupId && (
          <GroupDetail
            groupId={activeGroupId}
            currentUser={user}
            onBack={() => setCurrentView('dashboard')}
            onSelectExpense={(expId, currencySymbol) => {
              handleSelectExpense(expId, currencySymbol || 'USD'); 
            }}
          />
        )}
        
        {currentView === 'expense' && user && activeExpenseId && (
          <ExpenseDetail
            expenseId={activeExpenseId}
            currentUser={user}
            currency={activeGroupCurrency}
            onBack={() => setCurrentView('group')}
          />
        )}
      </div>
    </div>
  );
}

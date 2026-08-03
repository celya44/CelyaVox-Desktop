/**
 * Example: React component to display authenticated user and handle SAML events
 */

import React, { useEffect, useState } from 'react';
import './App.css';

interface User {
  name: string;
  email: string;
  method: string;
  claims?: any;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for SAML authentication events
    const setupListeners = () => {
      // @ts-ignore - electron is available in window
      if (!window.electron) {
        console.error('Electron API not available');
        setError('Application not running in Electron environment');
        setIsLoading(false);
        return;
      }

      // Listen for successful authentication
      // @ts-ignore
      const unsubscribeSAML = window.electron.on?.('saml:authenticated', (userData: User) => {
        console.log('✅ User authenticated:', userData);
        setUser(userData);
        setError(null);
        setIsLoading(false);
      });

      // Listen for authentication errors
      // @ts-ignore
      const unsubscribeError = window.electron.on?.('saml:error', (result: { error: string }) => {
        console.error('❌ Authentication error:', result.error);
        setError(result.error);
        setUser(null);
        setIsLoading(false);
      });

      // Try to get current user
      // @ts-ignore
      window.electron.invoke?.('saml:get-user').then((userData: User | null) => {
        if (userData) {
          setUser(userData);
          setError(null);
        }
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });

      return () => {
        unsubscribeSAML?.();
        unsubscribeError?.();
      };
    };

    setupListeners();
  }, []);

  const handleLogout = async () => {
    try {
      // @ts-ignore
      const result = await window.electron.invoke?.('saml:logout');
      if (result?.success) {
        setUser(null);
        setError(null);
        console.log('✅ User logged out');
      }
    } catch (err: any) {
      console.error('Logout failed:', err);
      setError(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="app">
        <div className="container">
          <h1>Loading...</h1>
          <p>Authenticating with SAML...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="container error">
          <h1>❌ Authentication Error</h1>
          <p>{error}</p>
          <p className="hint">Please check the configuration and try again.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <div className="container">
          <h1>Waiting for Authentication...</h1>
          <p>A browser window should open automatically.</p>
          <p className="hint">If not, check the application logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container success">
        <h1>✅ Authentication Successful!</h1>
        
        <div className="user-info">
          <h2>User Information</h2>
          <dl>
            <dt>Name:</dt>
            <dd>{user.name}</dd>
            
            <dt>Email:</dt>
            <dd>{user.email}</dd>
            
            <dt>Authentication Method:</dt>
            <dd>{user.method}</dd>
          </dl>
        </div>

        {user.claims && Object.keys(user.claims).length > 0 && (
          <div className="claims-info">
            <h3>SAML Claims</h3>
            <pre>{JSON.stringify(user.claims, null, 2)}</pre>
          </div>
        )}

        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
    </div>
  );
}

export default App;

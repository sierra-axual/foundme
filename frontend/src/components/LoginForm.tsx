import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginForm.css';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, error: authError, clearError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      setLocalError(null);
      clearError();
      
      await login(username.trim(), password);
      // Login successful - user will be redirected by the auth context
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setLocalError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = () => {
    if (localError) setLocalError(null);
    if (authError) clearError();
  };

  const errorMessage = localError || authError;

  return (
    <div className="login-form-container">
      <div className="login-form">
        <div className="login-header">
          <h2>🔐 Welcome Back</h2>
          <p>Sign in to your FoundMe account</p>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="username">Username or Email</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                handleInputChange();
              }}
              placeholder="Enter your username or email"
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                handleInputChange();
              }}
              placeholder="Enter your password"
              disabled={isLoading}
              required
            />
          </div>

          {errorMessage && (
            <div className="error-message">
              <span>❌ {errorMessage}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="form-footer">
          <p>
            Don't have an account?{' '}
            <button 
              type="button" 
              className="link-button"
              onClick={onSwitchToRegister}
              disabled={isLoading}
            >
              Sign up here
            </button>
          </p>
        </div>

        <div className="demo-credentials">
          <details>
            <summary>Demo Account (Development)</summary>
            <div className="demo-info">
              <p><strong>Username:</strong> admin</p>
              <p><strong>Password:</strong> admin123</p>
              <small>This is a development account. Change credentials in production.</small>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;

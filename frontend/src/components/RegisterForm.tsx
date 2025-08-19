import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './RegisterForm.css';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { register, error: authError, clearError } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (localError) setLocalError(null);
    if (authError) clearError();
  };

  const validateForm = (): string | null => {
    if (!formData.username.trim() || !formData.email.trim() || !formData.password) {
      return 'Please fill in all required fields';
    }

    if (formData.username.length < 3) {
      return 'Username must be at least 3 characters long';
    }

    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      setIsLoading(true);
      setLocalError(null);
      clearError();
      
      await register(
        formData.username.trim(),
        formData.email.trim().toLowerCase(),
        formData.password,
        formData.role
      );
      // Registration successful - user will be redirected by the auth context
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setLocalError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const errorMessage = localError || authError;

  return (
    <div className="register-form-container">
      <div className="register-form">
        <div className="register-header">
          <h2>🚀 Join FoundMe</h2>
          <p>Create your account to start tracking digital footprints</p>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Choose a unique username"
              disabled={isLoading}
              required
            />
            <small>Must be at least 3 characters long</small>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email address"
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Create a strong password"
              disabled={isLoading}
              required
            />
            <small>Must be at least 8 characters long</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm your password"
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Account Type</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              disabled={isLoading}
            >
              <option value="user">Standard User</option>
              <option value="admin">Administrator</option>
            </select>
            <small>Choose your account type (admin accounts have elevated privileges)</small>
          </div>

          {errorMessage && (
            <div className="error-message">
              <span>❌ {errorMessage}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="form-footer">
          <p>
            Already have an account?{' '}
            <button 
              type="button" 
              className="link-button"
              onClick={onSwitchToLogin}
              disabled={isLoading}
            >
              Sign in here
            </button>
          </p>
        </div>

        <div className="features-preview">
          <h3>What you'll get:</h3>
          <ul>
            <li>🔍 Advanced OSINT search capabilities</li>
            <li>📊 Comprehensive digital footprint analysis</li>
            <li>💾 Search history and result storage</li>
            <li>📈 Detailed reporting and analytics</li>
            <li>🔒 Secure and private investigations</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
  last_login?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'http://localhost:3001/api/auth';

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedTokens = localStorage.getItem('auth_tokens');
        if (storedTokens) {
          const parsedTokens = JSON.parse(storedTokens);
          setTokens(parsedTokens);
          
          // Verify token is still valid
          await verifyToken(parsedTokens.accessToken);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear invalid tokens
        localStorage.removeItem('auth_tokens');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Verify JWT token
  const verifyToken = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE}/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsAuthenticated(true);
        return true;
      } else {
        throw new Error('Token verification failed');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  };

  // Login function
  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setTokens(data.tokens);
        setIsAuthenticated(true);
        
        // Store tokens in localStorage
        localStorage.setItem('auth_tokens', JSON.stringify(data.tokens));
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (username: string, email: string, password: string, role: string = 'user') => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password, role })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setTokens(data.tokens);
        setIsAuthenticated(true);
        
        // Store tokens in localStorage
        localStorage.setItem('auth_tokens', JSON.stringify(data.tokens));
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error) {
      const errorMessage = error instanceof (Error) ? error.message : 'Registration failed';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      if (tokens?.accessToken) {
        // Call logout endpoint to invalidate token
        await fetch(`${API_BASE}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear local state regardless of API call success
      setUser(null);
      setTokens(null);
      setIsAuthenticated(false);
      localStorage.removeItem('auth_tokens');
    }
  };

  // Refresh access token
  const refreshToken = async () => {
    try {
      if (!tokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_BASE}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const newTokens = {
          accessToken: data.accessToken,
          refreshToken: tokens.refreshToken // Keep the same refresh token
        };
        
        setTokens(newTokens);
        localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
        
        // Update user info if provided
        if (data.user) {
          setUser(data.user);
        }
      } else {
        throw new Error(data.error || 'Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, logout the user
      logout();
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Set up automatic token refresh
  useEffect(() => {
    if (!tokens?.accessToken) return;

    // Check token expiration every minute
    const interval = setInterval(async () => {
      try {
        const tokenData = JSON.parse(atob(tokens.accessToken.split('.')[1]));
        const expirationTime = tokenData.exp * 1000; // Convert to milliseconds
        const currentTime = Date.now();
        
        // If token expires in less than 5 minutes, refresh it
        if (expirationTime - currentTime < 5 * 60 * 1000) {
          await refreshToken();
        }
      } catch (error) {
        console.error('Token expiration check failed:', error);
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [tokens]);

  const value: AuthContextType = {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshToken,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

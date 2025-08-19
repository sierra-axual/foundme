import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SearchForm from './SearchForm';
import SearchHistory from './SearchHistory';
import ResultsViewer from './ResultsViewer';
import StatusPanel from './StatusPanel';
import AdminPanel from './AdminPanel';
import ExportPanel from './ExportPanel';
import './OSINTDashboard.css';

interface SearchSession {
  id: string;
  session_name: string;
  search_type: string;
  status: string;
  created_at: string;
  total_results: number;
}

interface OSINTResult {
  id: string;
  target_identifier: string;
  target_type: string;
  tool_name: string;
  result_type: string;
  confidence_score: number;
  discovered_at: string;
  tags: string[];
}

const OSINTDashboard: React.FC = () => {
  const [activeSession, setActiveSession] = useState<SearchSession | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchSession[]>([]);
  const [searchResults, setSearchResults] = useState<OSINTResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'search' | 'history' | 'results' | 'admin' | 'export'>('search');

  const API_BASE = 'http://localhost:3001/api/osint';
  const { user, tokens, logout } = useAuth();

  // Fetch search history on component mount
  useEffect(() => {
    fetchSearchHistory();
  }, []);

  const fetchSearchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/history`, {
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchHistory(data.data.history);
      }
    } catch (error) {
      console.error('Failed to fetch search history:', error);
    }
  };

  const handleSearchSubmit = async (searchData: any) => {
    setIsLoading(true);
    setError(null);

    try {
      let endpoint = '';
      let payload = {};

      switch (searchData.searchType) {
        case 'username':
          endpoint = `${API_BASE}/search/username`;
          payload = { username: searchData.identifier, session_name: searchData.sessionName };
          break;
        case 'email':
          endpoint = `${API_BASE}/search/email`;
          payload = { email: searchData.identifier, session_name: searchData.sessionName };
          break;
        case 'full_profile':
          endpoint = `${API_BASE}/search/full-profile`;
          payload = {
            username: searchData.username,
            email: searchData.email,
            phone: searchData.phone,
            session_name: searchData.sessionName
          };
          break;
        default:
          throw new Error('Invalid search type');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        const session = data.data.session;
        
        setActiveSession(session);
        setSearchHistory(prev => [session, ...prev]);
        setView('results');
        
        // Start polling for results
        pollForResults(session.id);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const pollForResults = async (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/session/${sessionId}?results=true&summary=true`, {
          headers: {
            'Authorization': `Bearer ${tokens?.accessToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const session = data.data.session;
          
          if (session.status === 'completed' || session.status === 'failed') {
            clearInterval(pollInterval);
            
            if (session.status === 'completed') {
              setSearchResults(data.data.results || []);
              setActiveSession(session);
            } else {
              setError(session.error_message || 'Search failed');
            }
          } else {
            setActiveSession(session);
          }
        }
      } catch (error) {
        console.error('Failed to poll for results:', error);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const handleExportResults = async (format: 'json' | 'csv') => {
    if (!activeSession) return;

    try {
      const response = await fetch(`${API_BASE}/export/${activeSession.id}?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`
        }
      });

      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `osint_results_${activeSession.id}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        } else {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `osint_results_${activeSession.id}.json`;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      setError('Failed to export results');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE}/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`
        }
      });

      if (response.ok) {
        setSearchHistory(prev => prev.filter(s => s.id !== sessionId));
        if (activeSession?.id === sessionId) {
          setActiveSession(null);
          setSearchResults([]);
          setView('search');
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      setError('Failed to delete search session');
    }
  };

  return (
    <div className="osint-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🔍 FoundMe OSINT Platform</h1>
            <p>People Tracking & Digital Footprint Mapping</p>
          </div>
          <div className="header-right">
            <div className="user-info">
              <span>Welcome, {user?.username}</span>
              <small>{user?.role}</small>
            </div>
            <button onClick={logout} className="logout-button">
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="sidebar">
          <nav className="dashboard-nav">
            <button 
              className={`nav-button ${view === 'search' ? 'active' : ''}`}
              onClick={() => setView('search')}
            >
              🔎 New Search
            </button>
            <button 
              className={`nav-button ${view === 'history' ? 'active' : ''}`}
              onClick={() => setView('history')}
            >
              📚 Search History
            </button>
            {activeSession && (
              <button 
                className={`nav-button ${view === 'results' ? 'active' : ''}`}
                onClick={() => setView('results')}
              >
                📊 Results
              </button>
            )}
                          <button 
                className={`nav-button ${view === 'export' ? 'active' : ''}`}
                onClick={() => setView('export')}
              >
                📁 Export & Reports
              </button>
              
              {user?.role === 'admin' && (
                <button 
                  className={`nav-button ${view === 'admin' ? 'active' : ''}`}
                  onClick={() => setView('admin')}
                >
                  🔧 Admin Panel
                </button>
              )}
          </nav>

          <StatusPanel />
        </div>

        <main className="main-content">
          {error && (
            <div className="error-message">
              <span>❌ {error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {view === 'search' && (
            <SearchForm 
              onSubmit={handleSearchSubmit}
              isLoading={isLoading}
            />
          )}

          {view === 'history' && (
            <SearchHistory 
              history={searchHistory}
              onSelectSession={(session) => {
                setActiveSession(session);
                setView('results');
                if (session.status === 'completed') {
                  fetchSessionResults(session.id);
                }
              }}
              onDeleteSession={handleDeleteSession}
            />
          )}

          {view === 'results' && activeSession && (
            <ResultsViewer 
              session={activeSession}
              results={searchResults}
              onExport={handleExportResults}
              onRefresh={() => activeSession && fetchSessionResults(activeSession.id)}
            />
          )}

          {view === 'export' && (
            <ExportPanel 
              searchResults={searchResults}
              targetIdentifier={activeSession?.session_name}
              targetType={activeSession?.search_type}
              onExportComplete={(exportInfo) => {
                console.log('Export completed:', exportInfo);
                // Optionally refresh data or show success message
              }}
            />
          )}
          
          {view === 'admin' && (
            <AdminPanel />
          )}
        </main>
      </div>
    </div>
  );

  async function fetchSessionResults(sessionId: string) {
    try {
      const response = await fetch(`${API_BASE}/session/${sessionId}?results=true`, {
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch session results:', error);
    }
  }
};

export default OSINTDashboard;

import React, { useState } from 'react';
import './SearchHistory.css';

interface SearchSession {
  id: string;
  session_name: string;
  search_type: string;
  status: string;
  created_at: string;
  total_results: number;
  started_at?: string;
  completed_at?: string;
}

interface SearchHistoryProps {
  history: SearchSession[];
  onSelectSession: (session: SearchSession) => void;
  onDeleteSession: (sessionId: string) => void;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ 
  history, 
  onSelectSession, 
  onDeleteSession 
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter(session => {
    const matchesStatus = filterStatus === 'all' || session.status === filterStatus;
    const matchesSearch = session.session_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.search_type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'running':
        return '🔄';
      case 'failed':
        return '❌';
      case 'pending':
        return '⏳';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'warning';
      case 'failed':
        return 'error';
      case 'pending':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'running':
        return 'Running';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return null;
    
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    
    if (durationMs < 60000) {
      return `${Math.floor(durationMs / 1000)}s`;
    } else if (durationMs < 3600000) {
      return `${Math.floor(durationMs / 60000)}m`;
    } else {
      return `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m`;
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this search session?')) {
      onDeleteSession(sessionId);
    }
  };

  if (history.length === 0) {
    return (
      <div className="search-history-empty">
        <div className="empty-icon">📚</div>
        <h3>No Search History</h3>
        <p>Start your first OSINT search to see results here</p>
      </div>
    );
  }

  return (
    <div className="search-history-container">
      <div className="history-header">
        <h2>📚 Search History</h2>
        <p>View and manage your previous OSINT searches</p>
      </div>

      <div className="history-controls">
        <div className="search-filter">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="status-filter">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="status-select"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="running">Running</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <div className="history-stats">
        <div className="stat-item">
          <span className="stat-label">Total Sessions:</span>
          <span className="stat-value">{history.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Completed:</span>
          <span className="stat-value success">
            {history.filter(s => s.status === 'completed').length}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Running:</span>
          <span className="stat-value warning">
            {history.filter(s => s.status === 'running').length}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Failed:</span>
          <span className="stat-value error">
            {history.filter(s => s.status === 'failed').length}
          </span>
        </div>
      </div>

      <div className="history-list">
        {filteredHistory.map((session) => (
          <div
            key={session.id}
            className="history-item"
            onClick={() => onSelectSession(session)}
          >
            <div className="item-header">
              <div className="item-title">
                <span className="status-icon">{getStatusIcon(session.status)}</span>
                <h4>{session.session_name}</h4>
                <span className={`status-badge ${getStatusColor(session.status)}`}>
                  {getStatusText(session.status)}
                </span>
              </div>
              <button
                className="delete-btn"
                onClick={(e) => handleDeleteClick(e, session.id)}
                title="Delete session"
              >
                🗑️
              </button>
            </div>

            <div className="item-details">
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{session.search_type}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Created:</span>
                <span className="detail-value">{formatDate(session.created_at)}</span>
              </div>
              {session.started_at && (
                <div className="detail-row">
                  <span className="detail-label">Started:</span>
                  <span className="detail-value">{formatDate(session.started_at)}</span>
                </div>
              )}
              {session.completed_at && (
                <div className="detail-row">
                  <span className="detail-label">Completed:</span>
                  <span className="detail-value">{formatDate(session.completed_at)}</span>
                </div>
              )}
              {getDuration(session.started_at, session.completed_at) && (
                <div className="detail-row">
                  <span className="detail-label">Duration:</span>
                  <span className="detail-value">{getDuration(session.started_at, session.completed_at)}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Results:</span>
                <span className="detail-value">{session.total_results}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredHistory.length === 0 && (
        <div className="no-results">
          <p>No sessions match your current filters</p>
          <button 
            className="clear-filters-btn"
            onClick={() => {
              setFilterStatus('all');
              setSearchTerm('');
            }}
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchHistory;

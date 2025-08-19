import React, { useState } from 'react';
import './ResultsViewer.css';

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

interface OSINTResult {
  id: string;
  target_identifier: string;
  target_type: string;
  tool_name: string;
  result_type: string;
  result_data: any;
  confidence_score: number;
  source_url?: string;
  discovered_at: string;
  is_verified: boolean;
  tags: string[];
}

interface ResultsViewerProps {
  session: SearchSession;
  results: OSINTResult[];
  onExport: (format: 'json' | 'csv') => void;
  onRefresh: () => void;
}

const ResultsViewer: React.FC<ResultsViewerProps> = ({ 
  session, 
  results, 
  onExport, 
  onRefresh 
}) => {
  const [selectedResult, setSelectedResult] = useState<OSINTResult | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'discovered_at' | 'confidence_score' | 'tool_name'>('discovered_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredResults = results.filter(result => {
    if (filterType === 'all') return true;
    return result.result_type === filterType;
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    let aValue: any = a[sortBy];
    let bValue: any = b[sortBy];

    if (sortBy === 'discovered_at') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const getResultTypeIcon = (resultType: string) => {
    switch (resultType) {
      case 'social_account':
        return '👤';
      case 'breach':
        return '🔓';
      case 'metadata':
        return '📊';
      case 'profile':
        return '👨‍💼';
      default:
        return '📄';
    }
  };

  const getToolIcon = (toolName: string) => {
    const toolIcons: Record<string, string> = {
      sherlock: '🕵️',
      theharvester: '🌾',
      holehe: '🕳️',
      h8mail: '📧',
      maigret: '🎭'
    };
    return toolIcons[toolName] || '🔧';
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatResultData = (data: any) => {
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  const getResultSummary = () => {
    const summary = {
      total: results.length,
      social_accounts: results.filter(r => r.result_type === 'social_account').length,
      breaches: results.filter(r => r.result_type === 'breach').length,
      metadata: results.filter(r => r.result_type === 'metadata').length,
      profiles: results.filter(r => r.result_type === 'profile').length,
      avg_confidence: results.length > 0 
        ? (results.reduce((sum, r) => sum + r.confidence_score, 0) / results.length).toFixed(2)
        : 0
    };
    return summary;
  };

  const summary = getResultSummary();

  return (
    <div className="results-viewer">
      <div className="results-header">
        <div className="session-info">
          <h2>📊 Search Results</h2>
          <h3>{session.session_name}</h3>
          <div className="session-meta">
            <span className="meta-item">
              <strong>Type:</strong> {session.search_type}
            </span>
            <span className="meta-item">
              <strong>Status:</strong> 
              <span className={`status-badge ${session.status}`}>
                {session.status}
              </span>
            </span>
            <span className="meta-item">
              <strong>Created:</strong> {formatDate(session.created_at)}
            </span>
            {session.completed_at && (
              <span className="meta-item">
                <strong>Completed:</strong> {formatDate(session.completed_at)}
              </span>
            )}
          </div>
        </div>

        <div className="results-actions">
          <button className="refresh-btn" onClick={onRefresh}>
            🔄 Refresh
          </button>
          <button className="export-btn" onClick={() => onExport('json')}>
            📄 Export JSON
          </button>
          <button className="export-btn" onClick={() => onExport('csv')}>
            📊 Export CSV
          </button>
        </div>
      </div>

      <div className="results-summary">
        <div className="summary-card">
          <span className="summary-icon">📊</span>
          <div className="summary-content">
            <span className="summary-value">{summary.total}</span>
            <span className="summary-label">Total Results</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-icon">👤</span>
          <div className="summary-content">
            <span className="summary-value">{summary.social_accounts}</span>
            <span className="summary-label">Social Accounts</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-icon">🔓</span>
          <div className="summary-content">
            <span className="summary-value">{summary.breaches}</span>
            <span className="summary-label">Data Breaches</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-icon">📊</span>
          <div className="summary-content">
            <span className="summary-value">{summary.avg_confidence}</span>
            <span className="summary-label">Avg Confidence</span>
          </div>
        </div>
      </div>

      <div className="results-controls">
        <div className="filter-controls">
          <label>Filter by Type:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="social_account">Social Accounts</option>
            <option value="breach">Data Breaches</option>
            <option value="metadata">Metadata</option>
            <option value="profile">Profiles</option>
          </select>
        </div>

        <div className="sort-controls">
          <label>Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="sort-select"
          >
            <option value="discovered_at">Discovery Date</option>
            <option value="confidence_score">Confidence Score</option>
            <option value="tool_name">Tool Name</option>
          </select>
          <button
            className="sort-order-btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="results-content">
        {results.length === 0 ? (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <h3>No Results Yet</h3>
            <p>
              {session.status === 'running' 
                ? 'Search is still running. Results will appear here when complete.'
                : 'No results were found for this search.'
              }
            </p>
          </div>
        ) : (
          <div className="results-list">
            {sortedResults.map((result) => (
              <div
                key={result.id}
                className={`result-item ${selectedResult?.id === result.id ? 'selected' : ''}`}
                onClick={() => setSelectedResult(selectedResult?.id === result.id ? null : result)}
              >
                <div className="result-header">
                  <div className="result-type">
                    <span className="type-icon">{getResultTypeIcon(result.result_type)}</span>
                    <span className="type-text">{result.result_type.replace('_', ' ')}</span>
                  </div>
                  <div className="result-tool">
                    <span className="tool-icon">{getToolIcon(result.tool_name)}</span>
                    <span className="tool-name">{result.tool_name}</span>
                  </div>
                  <div className="result-confidence">
                    <span className={`confidence-badge ${getConfidenceColor(result.confidence_score)}`}>
                      {Math.round(result.confidence_score * 100)}%
                    </span>
                  </div>
                </div>

                <div className="result-content">
                  <div className="result-target">
                    <strong>Target:</strong> {result.target_identifier}
                  </div>
                  <div className="result-discovered">
                    <strong>Discovered:</strong> {formatDate(result.discovered_at)}
                  </div>
                  {result.tags.length > 0 && (
                    <div className="result-tags">
                      <strong>Tags:</strong>
                      {result.tags.map((tag, index) => (
                        <span key={index} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {selectedResult?.id === result.id && (
                  <div className="result-details">
                    <div className="detail-section">
                      <h4>Result Data:</h4>
                      <pre className="result-data">
                        {formatResultData(result.result_data)}
                      </pre>
                    </div>
                    {result.source_url && (
                      <div className="detail-section">
                        <h4>Source:</h4>
                        <a href={result.source_url} target="_blank" rel="noopener noreferrer">
                          {result.source_url}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsViewer;

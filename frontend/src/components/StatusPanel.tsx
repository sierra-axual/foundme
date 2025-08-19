import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './StatusPanel.css';

interface ToolStatus {
  available: boolean;
  error?: string;
}

interface StatusPanelProps {}

const StatusPanel: React.FC<StatusPanelProps> = () => {
  const { tokens } = useAuth();
  const [toolsStatus, setToolsStatus] = useState<Record<string, ToolStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const API_BASE = 'http://localhost:3001/api/osint';

  useEffect(() => {
    if (tokens?.accessToken) {
      fetchToolsStatus();
      const interval = setInterval(fetchToolsStatus, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [tokens?.accessToken]);

  const fetchToolsStatus = async () => {
    if (!tokens?.accessToken) return;
    
    try {
      const response = await fetch(`${API_BASE}/tools/status`, {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setToolsStatus(data.data.tools);
        setLastUpdated(new Date());
      } else if (response.status === 401) {
        console.warn('Authentication expired, skipping tools status fetch');
      }
    } catch (error) {
      console.error('Failed to fetch tools status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (available: boolean) => {
    return available ? '✅' : '❌';
  };

  const getStatusColor = (available: boolean) => {
    return available ? 'success' : 'error';
  };

  const getToolDisplayName = (toolName: string) => {
    const displayNames: Record<string, string> = {
      sherlock: 'Sherlock',
      theharvester: 'theHarvester',
      holehe: 'Holehe',
      h8mail: 'H8mail',
      maigret: 'Maigret'
    };
    return displayNames[toolName] || toolName;
  };

  const getToolDescription = (toolName: string) => {
    const descriptions: Record<string, string> = {
      sherlock: 'Username enumeration across 400+ social networks',
      theharvester: 'Email and person information gathering',
      holehe: 'Email account checker for 120+ websites',
      h8mail: 'Email-based password breach hunting',
      maigret: 'Advanced username OSINT collection'
    };
    return descriptions[toolName] || 'OSINT tool';
  };

  const availableTools = Object.values(toolsStatus).filter(tool => tool.available).length;
  const totalTools = Object.keys(toolsStatus).length;

  return (
    <div className="status-panel">
      <div className="status-header">
        <h3>🔧 System Status</h3>
        <button 
          className="refresh-btn"
          onClick={fetchToolsStatus}
          disabled={isLoading}
        >
          {isLoading ? '🔄' : '🔄'}
        </button>
      </div>

      <div className="status-summary">
        <div className="status-item">
          <span className="status-label">Tools Available:</span>
          <span className={`status-value ${availableTools > 0 ? 'success' : 'error'}`}>
            {availableTools}/{totalTools}
          </span>
        </div>
        {lastUpdated && (
          <div className="status-item">
            <span className="status-label">Last Updated:</span>
            <span className="status-value">
              {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      <div className="tools-status">
        <h4>OSINT Tools</h4>
        {Object.entries(toolsStatus).map(([toolName, status]) => (
          <div key={toolName} className="tool-status">
            <div className="tool-header">
              <span className="tool-icon">{getStatusIcon(status.available)}</span>
              <span className="tool-name">{getToolDisplayName(toolName)}</span>
              <span className={`tool-status-badge ${getStatusColor(status.available)}`}>
                {status.available ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <p className="tool-description">{getToolDescription(toolName)}</p>
            {status.error && (
              <div className="tool-error">
                <span className="error-icon">⚠️</span>
                <span className="error-message">{status.error}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <span>Checking tools status...</span>
        </div>
      )}
    </div>
  );
};

export default StatusPanel;

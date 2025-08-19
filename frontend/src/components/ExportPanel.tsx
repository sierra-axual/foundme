import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ExportPanel.css';

interface ExportFile {
  filename: string;
  size: number;
  created: string;
  modified: string;
  format: string;
}

interface ExportPanelProps {
  searchResults?: any[];
  targetIdentifier?: string;
  targetType?: string;
  onExportComplete?: (exportInfo: any) => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ 
  searchResults = [], 
  targetIdentifier, 
  targetType,
  onExportComplete 
}) => {
  const { tokens } = useAuth();
  const [exportFiles, setExportFiles] = useState<ExportFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [exportForm, setExportForm] = useState({
    filename: '',
    format: 'csv',
    includeCorrelations: true,
    includeTimeline: true,
    includeRiskAssessment: true,
    includeRecommendations: true
  });

  useEffect(() => {
    if (targetIdentifier && !exportForm.filename) {
      const timestamp = new Date().toISOString().split('T')[0];
      setExportForm(prev => ({
        ...prev,
        filename: `osint_report_${targetIdentifier}_${timestamp}`
      }));
    }
    loadExportFiles();
  }, [targetIdentifier]);

  const loadExportFiles = async () => {
    try {
      const response = await fetch('/api/export/files', {
        headers: { 'Authorization': `Bearer ${tokens?.accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setExportFiles(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load export files:', err);
    }
  };

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!exportForm.filename.trim()) {
      setError('Please enter a filename');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let endpoint = '';
      let payload: any = {};

      if (type === 'csv') {
        if (searchResults.length > 0) {
          // Export search results to CSV
          endpoint = '/api/export/csv/search-results';
          payload = {
            results: searchResults,
            filename: exportForm.filename
          };
        } else if (targetIdentifier) {
          // Export OSINT report to CSV
          endpoint = '/api/export/csv/report';
          payload = {
            targetIdentifier,
            targetType,
            filename: exportForm.filename,
            options: {
              includeCorrelations: exportForm.includeCorrelations,
              includeTimeline: exportForm.includeTimeline,
              includeRiskAssessment: exportForm.includeRiskAssessment,
              includeRecommendations: exportForm.includeRecommendations
            }
          };
        }
      } else if (type === 'pdf' && targetIdentifier) {
        // Export OSINT report to PDF
        endpoint = '/api/export/pdf/report';
        payload = {
          targetIdentifier,
          targetType,
          filename: exportForm.filename,
          options: {
            includeCorrelations: exportForm.includeCorrelations,
            includeTimeline: exportForm.includeTimeline,
            includeRiskAssessment: exportForm.includeRiskAssessment,
            includeRecommendations: exportForm.includeRecommendations
          }
        };
      }

      if (!endpoint) {
        setError('No data available for export');
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(`${type.toUpperCase()} export completed successfully!`);
        onExportComplete?.(data.data);
        loadExportFiles(); // Refresh the file list
      } else {
        const errorData = await response.json();
        setError(errorData.error || `Failed to export to ${type.toUpperCase()}`);
      }
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (filename: string) => {
    try {
      const response = await fetch(`/api/export/download/${filename}`, {
        headers: { 'Authorization': `Bearer ${tokens?.accessToken}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Failed to download file');
      }
    } catch (err) {
      setError('Download failed');
    }
  };

  const deleteFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/export/files/${filename}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens?.accessToken}` }
      });
      
      if (response.ok) {
        setSuccess('File deleted successfully');
        loadExportFiles(); // Refresh the file list
      } else {
        setError('Failed to delete file');
      }
    } catch (err) {
      setError('Delete failed');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="export-panel">
      <div className="export-header">
        <h3>📁 Export & Reports</h3>
        <p>Export OSINT data and generate comprehensive reports</p>
      </div>

      {/* Export Form */}
      <div className="export-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="filename">Filename:</label>
            <input
              type="text"
              id="filename"
              value={exportForm.filename}
              onChange={(e) => setExportForm(prev => ({ ...prev, filename: e.target.value }))}
              placeholder="Enter filename (without extension)"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="format">Format:</label>
            <select
              id="format"
              value={exportForm.format}
              onChange={(e) => setExportForm(prev => ({ ...prev, format: e.target.value }))}
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF/HTML</option>
            </select>
          </div>
        </div>

        {targetIdentifier && (
          <div className="export-options">
            <h4>Report Options:</h4>
            <div className="options-grid">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={exportForm.includeCorrelations}
                  onChange={(e) => setExportForm(prev => ({ ...prev, includeCorrelations: e.target.checked }))}
                />
                Include Data Correlations
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={exportForm.includeTimeline}
                  onChange={(e) => setExportForm(prev => ({ ...prev, includeTimeline: e.target.checked }))}
                />
                Include Timeline
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={exportForm.includeRiskAssessment}
                  onChange={(e) => setExportForm(prev => ({ ...prev, includeRiskAssessment: e.target.checked }))}
                />
                Include Risk Assessment
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={exportForm.includeRecommendations}
                  onChange={(e) => setExportForm(prev => ({ ...prev, includeRecommendations: e.target.checked }))}
                />
                Include Recommendations
              </label>
            </div>
          </div>
        )}

        <div className="export-actions">
          {searchResults.length > 0 && (
            <button
              className="export-btn csv-btn"
              onClick={() => handleExport('csv')}
              disabled={loading}
            >
              {loading ? '⏳ Exporting...' : '📊 Export Results to CSV'}
            </button>
          )}
          
          {targetIdentifier && (
            <>
              <button
                className="export-btn csv-btn"
                onClick={() => handleExport('csv')}
                disabled={loading}
              >
                {loading ? '⏳ Exporting...' : '📊 Export Report to CSV'}
              </button>
              
              <button
                className="export-btn pdf-btn"
                onClick={() => handleExport('pdf')}
                disabled={loading}
              >
                {loading ? '⏳ Exporting...' : '📄 Export Report to PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="error-message">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}
      
      {success && (
        <div className="success-message">
          <span>✅ {success}</span>
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}

      {/* Export Files List */}
      <div className="export-files">
        <div className="files-header">
          <h4>📁 Export Files</h4>
          <button 
            className="refresh-btn"
            onClick={loadExportFiles}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>
        
        {exportFiles.length === 0 ? (
          <p className="no-files">No export files found</p>
        ) : (
          <div className="files-list">
            {exportFiles.map((file) => (
              <div key={file.filename} className="file-item">
                <div className="file-info">
                  <div className="file-name">
                    <span className={`file-icon ${file.format}`}>
                      {file.format === 'csv' ? '📊' : '📄'}
                    </span>
                    {file.filename}
                  </div>
                  <div className="file-details">
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    <span className="file-date">{formatDate(file.modified)}</span>
                  </div>
                </div>
                
                <div className="file-actions">
                  <button
                    className="download-btn"
                    onClick={() => downloadFile(file.filename)}
                    title="Download file"
                  >
                    ⬇️ Download
                  </button>
                  
                  <button
                    className="delete-btn"
                    onClick={() => deleteFile(file.filename)}
                    title="Delete file"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportPanel;

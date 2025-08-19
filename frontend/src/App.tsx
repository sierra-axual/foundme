import React from 'react'
import './App.css'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🔎 FoundMe Platform</h1>
        <p>Data Discovery & Footprint Mapping</p>
        <div className="status">
          <h2>Development Environment Status</h2>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Backend API:</span>
              <span className="status-value success">✅ Running (Port 3001)</span>
            </div>
            <div className="status-item">
              <span className="status-label">Frontend:</span>
              <span className="status-value success">✅ Running (Port 8472)</span>
            </div>
            <div className="status-item">
              <span className="status-label">PostgreSQL:</span>
              <span className="status-value success">✅ Running (Port 7942)</span>
            </div>
            <div className="status-item">
              <span className="status-label">Redis:</span>
              <span className="status-value success">✅ Running (Port 6379)</span>
            </div>
          </div>
          <p className="note">
            Development environment is ready! You can now start building the platform features.
          </p>
        </div>
      </header>
    </div>
  )
}

export default App

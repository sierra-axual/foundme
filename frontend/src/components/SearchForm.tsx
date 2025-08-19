import React, { useState } from 'react';
import './SearchForm.css';

interface SearchFormProps {
  onSubmit: (searchData: any) => void;
  isLoading: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSubmit, isLoading }) => {
  const [searchType, setSearchType] = useState<'username' | 'email' | 'full_profile'>('username');
  const [sessionName, setSessionName] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const searchData = {
      searchType,
      sessionName: sessionName || `${searchType} search`,
      ...formData
    };

    onSubmit(searchData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getPlaceholderText = () => {
    switch (searchType) {
      case 'username':
        return 'Enter username to search across social networks';
      case 'email':
        return 'Enter email address to investigate';
      case 'full_profile':
        return 'Enter multiple identifiers for comprehensive search';
      default:
        return '';
    }
  };

  const renderSearchFields = () => {
    switch (searchType) {
      case 'username':
        return (
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="e.g., john_doe, johndoe123"
              required
            />
          </div>
        );

      case 'email':
        return (
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="e.g., john.doe@example.com"
              required
            />
          </div>
        );

      case 'full_profile':
        return (
          <>
            <div className="form-group">
              <label htmlFor="username">Username (Optional)</label>
              <input
                type="text"
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="e.g., john_doe"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email Address (Optional)</label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="e.g., john.doe@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone Number (Optional)</label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="e.g., +1-555-123-4567"
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const getSearchDescription = () => {
    switch (searchType) {
      case 'username':
        return 'Search for a username across 400+ social networks using Sherlock and Maigret';
      case 'email':
        return 'Investigate an email address for account verification, data breaches, and metadata';
      case 'full_profile':
        return 'Comprehensive investigation using multiple identifiers for complete digital footprint mapping';
      default:
        return '';
    }
  };

  const getToolsUsed = () => {
    switch (searchType) {
      case 'username':
        return ['Sherlock', 'Maigret'];
      case 'email':
        return ['Holehe', 'H8mail', 'theHarvester'];
      case 'full_profile':
        return ['Sherlock', 'Maigret', 'Holehe', 'H8mail', 'theHarvester'];
      default:
        return [];
    }
  };

  return (
    <div className="search-form-container">
      <div className="search-form-header">
        <h2>🔍 New OSINT Search</h2>
        <p>Choose your search type and enter the target information</p>
      </div>

      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-type-selector">
          <label>Search Type:</label>
          <div className="search-type-buttons">
            <button
              type="button"
              className={`search-type-btn ${searchType === 'username' ? 'active' : ''}`}
              onClick={() => setSearchType('username')}
            >
              👤 Username Search
            </button>
            <button
              type="button"
              className={`search-type-btn ${searchType === 'email' ? 'active' : ''}`}
              onClick={() => setSearchType('email')}
            >
              📧 Email Investigation
            </button>
            <button
              type="button"
              className={`search-type-btn ${searchType === 'full_profile' ? 'active' : ''}`}
              onClick={() => setSearchType('full_profile')}
            >
              🎯 Full Profile Search
            </button>
          </div>
        </div>

        <div className="search-description">
          <p>{getSearchDescription()}</p>
          <div className="tools-used">
            <span>Tools: </span>
            {getToolsUsed().map((tool, index) => (
              <span key={tool} className="tool-tag">
                {tool}{index < getToolsUsed().length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        </div>

        <div className="form-fields">
          {renderSearchFields()}

          <div className="form-group">
            <label htmlFor="sessionName">Session Name (Optional)</label>
            <input
              type="text"
              id="sessionName"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Give your search a memorable name"
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading || !isFormValid()}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Starting Search...
              </>
            ) : (
              '🚀 Start Search'
            )}
          </button>
        </div>
      </form>

      <div className="search-info">
        <h3>ℹ️ Search Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <strong>Username Search:</strong>
            <p>Finds social media accounts across multiple platforms</p>
          </div>
          <div className="info-item">
            <strong>Email Investigation:</strong>
            <p>Checks email validity, finds data breaches, and gathers metadata</p>
          </div>
          <div className="info-item">
            <strong>Full Profile:</strong>
            <p>Comprehensive investigation using all available identifiers</p>
          </div>
        </div>
      </div>
    </div>
  );

  function isFormValid(): boolean {
    switch (searchType) {
      case 'username':
        return formData.username.trim().length > 0;
      case 'email':
        return formData.email.trim().length > 0;
      case 'full_profile':
        return formData.username.trim().length > 0 || 
               formData.email.trim().length > 0 || 
               formData.phone.trim().length > 0;
      default:
        return false;
    }
  }
};

export default SearchForm;

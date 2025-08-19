-- FoundMe Platform Discovery Schema
-- This script creates the tables for OSINT discovery and scanning

-- OSINT scans table
CREATE TABLE osint_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target VARCHAR(500) NOT NULL,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('email', 'phone', 'name', 'username', 'domain', 'company')),
    scan_type VARCHAR(50) NOT NULL CHECK (scan_type IN ('social', 'darkweb', 'metadata', 'geolocation', 'comprehensive')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_completion TIMESTAMP,
    results JSONB DEFAULT '{}',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scan results table - Detailed findings from scans
CREATE TABLE scan_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES osint_scans(id) ON DELETE CASCADE,
    result_type VARCHAR(50) NOT NULL CHECK (result_type IN ('social_media', 'dark_web', 'metadata', 'geolocation', 'domain', 'email', 'phone')),
    source VARCHAR(255) NOT NULL,
    url VARCHAR(1000),
    title TEXT,
    description TEXT,
    content TEXT,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Social media accounts table
CREATE TABLE social_media_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES osint_scans(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL,
    username VARCHAR(255),
    display_name VARCHAR(255),
    profile_url VARCHAR(1000),
    bio TEXT,
    followers_count INTEGER,
    following_count INTEGER,
    posts_count INTEGER,
    verified BOOLEAN DEFAULT false,
    last_activity TIMESTAMP,
    privacy_level VARCHAR(20) DEFAULT 'public' CHECK (privacy_level IN ('public', 'private', 'protected')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dark web findings table
CREATE TABLE dark_web_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES osint_scans(id) ON DELETE CASCADE,
    source VARCHAR(255) NOT NULL,
    breach_name VARCHAR(500),
    breach_date DATE,
    data_types TEXT[],
    record_count INTEGER,
    description TEXT,
    url VARCHAR(1000),
    verified BOOLEAN DEFAULT false,
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    metadata JSONB DEFAULT '{}',
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metadata findings table
CREATE TABLE metadata_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES osint_scans(id) ON DELETE CASCADE,
    file_type VARCHAR(50),
    file_name VARCHAR(500),
    file_size BIGINT,
    exif_data JSONB DEFAULT '{}',
    gps_coordinates POINT,
    author VARCHAR(255),
    creation_date TIMESTAMP,
    modification_date TIMESTAMP,
    software_used VARCHAR(255),
    risk_factors TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Geolocation findings table
CREATE TABLE geolocation_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES osint_scans(id) ON DELETE CASCADE,
    location_type VARCHAR(50) NOT NULL CHECK (location_type IN ('post', 'photo', 'checkin', 'travel', 'residence', 'work')),
    coordinates POINT NOT NULL,
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(255),
    postal_code VARCHAR(20),
    accuracy_meters INTEGER,
    source VARCHAR(255),
    timestamp TIMESTAMP,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_osint_scans_user_id ON osint_scans(user_id);
CREATE INDEX idx_osint_scans_target ON osint_scans(target);
CREATE INDEX idx_osint_scans_status ON osint_scans(status);
CREATE INDEX idx_osint_scans_created_at ON osint_scans(created_at);
CREATE INDEX idx_osint_scans_target_type ON osint_scans(target_type);
CREATE INDEX idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX idx_scan_results_result_type ON scan_results(result_type);
CREATE INDEX idx_scan_results_risk_level ON scan_results(risk_level);
CREATE INDEX idx_social_media_accounts_scan_id ON social_media_accounts(scan_id);
CREATE INDEX idx_social_media_accounts_platform ON social_media_accounts(platform);
CREATE INDEX idx_social_media_accounts_username ON social_media_accounts(username);
CREATE INDEX idx_dark_web_findings_scan_id ON dark_web_findings(scan_id);
CREATE INDEX idx_dark_web_findings_source ON dark_web_findings(source);
CREATE INDEX idx_dark_web_findings_breach_date ON dark_web_findings(breach_date);
CREATE INDEX idx_metadata_findings_scan_id ON metadata_findings(scan_id);
CREATE INDEX idx_metadata_findings_file_type ON metadata_findings(file_type);
CREATE INDEX idx_geolocation_findings_scan_id ON geolocation_findings(scan_id);
CREATE INDEX idx_geolocation_findings_coordinates ON geolocation_findings USING GIST(coordinates);
CREATE INDEX idx_geolocation_findings_location_type ON geolocation_findings(location_type);

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_osint_scans_updated_at BEFORE UPDATE ON osint_scans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_media_accounts_updated_at BEFORE UPDATE ON social_media_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FoundMe Platform - OSINT Data Storage Schema
-- Migration: 01-create-osint-schema.sql
-- Purpose: Create tables for storing people OSINT search results and user data

-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and user management
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    search_quota_daily INTEGER DEFAULT 100,
    search_quota_monthly INTEGER DEFAULT 1000
);

-- Search sessions table to track user search activities
CREATE TABLE IF NOT EXISTS search_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    search_type VARCHAR(50) NOT NULL, -- 'username', 'email', 'phone', 'full_profile'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    total_results INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB -- Store additional search parameters
);

-- OSINT results table for storing all search findings
CREATE TABLE IF NOT EXISTS osint_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_session_id UUID REFERENCES search_sessions(id) ON DELETE CASCADE,
    target_identifier VARCHAR(255) NOT NULL, -- username, email, phone, etc.
    target_type VARCHAR(50) NOT NULL, -- 'username', 'email', 'phone'
    tool_name VARCHAR(100) NOT NULL, -- 'sherlock', 'holehe', 'h8mail', etc.
    result_type VARCHAR(50) NOT NULL, -- 'social_account', 'breach', 'metadata', 'profile'
    result_data JSONB NOT NULL, -- Store the actual OSINT findings
    confidence_score DECIMAL(3,2) DEFAULT 0.0, -- 0.00 to 1.00
    source_url VARCHAR(500),
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT false,
    tags TEXT[] -- Array of tags for categorization
);

-- Social media accounts table for structured social findings
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    osint_result_id UUID REFERENCES osint_results(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL, -- 'twitter', 'facebook', 'linkedin', etc.
    username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    profile_url VARCHAR(500),
    bio TEXT,
    follower_count INTEGER,
    following_count INTEGER,
    post_count INTEGER,
    account_age_days INTEGER,
    is_verified BOOLEAN DEFAULT false,
    last_activity TIMESTAMP,
    metadata JSONB -- Store platform-specific data
);

-- Data breaches table for storing breach information
CREATE TABLE IF NOT EXISTS data_breaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    osint_result_id UUID REFERENCES osint_results(id) ON DELETE CASCADE,
    breach_name VARCHAR(255) NOT NULL,
    breach_date DATE,
    company VARCHAR(255),
    breach_type VARCHAR(100), -- 'password', 'personal_info', 'financial', etc.
    compromised_data TEXT[], -- Array of compromised data types
    severity VARCHAR(50), -- 'low', 'medium', 'high', 'critical'
    source_url VARCHAR(500),
    verification_status VARCHAR(50) DEFAULT 'unverified', -- 'unverified', 'verified', 'false_positive'
    metadata JSONB
);

-- Search history table for user activity tracking
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    search_query VARCHAR(500) NOT NULL,
    search_type VARCHAR(50) NOT NULL,
    results_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Favorites/bookmarks table for users to save important findings
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    osint_result_id UUID REFERENCES osint_results(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, osint_result_id)
);

-- Rate limiting table for tracking API usage
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    window_end TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    UNIQUE(user_id, tool_name, window_start)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_osint_results_search_session ON osint_results(search_session_id);
CREATE INDEX IF NOT EXISTS idx_osint_results_target_identifier ON osint_results(target_identifier);
CREATE INDEX IF NOT EXISTS idx_osint_results_tool_name ON osint_results(tool_name);
CREATE INDEX IF NOT EXISTS idx_osint_results_discovered_at ON osint_results(discovered_at);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_username ON social_accounts(username);
CREATE INDEX IF NOT EXISTS idx_data_breaches_breach_name ON data_breaches(breach_name);
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_tool ON rate_limits(user_id, tool_name);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - should be changed in production)
INSERT INTO users (username, email, password_hash, role, search_quota_daily, search_quota_monthly) 
VALUES ('admin', 'admin@foundme.local', '$2b$10$rQZ8K9LmN2PqR3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P', 'admin', 1000, 10000)
ON CONFLICT (username) DO NOTHING;

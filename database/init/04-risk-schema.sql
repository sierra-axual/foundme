-- FoundMe Platform Risk Assessment Schema
-- This script creates the tables for risk assessment and analysis

-- Risk assessments table
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target VARCHAR(500) NOT NULL,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('email', 'phone', 'name', 'username', 'domain', 'company', 'person')),
    overall_risk_score INTEGER NOT NULL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    scan_results JSONB DEFAULT '{}',
    risk_factors JSONB DEFAULT '[]',
    custom_weights JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'superseded')),
    calculated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk factors table - Individual risk components
CREATE TABLE risk_factors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('social_media', 'dark_web', 'metadata', 'geolocation', 'domain', 'email', 'phone', 'financial', 'professional')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    weight DECIMAL(3,2) DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 2.0),
    evidence JSONB DEFAULT '{}',
    mitigation_suggestions TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk trends table - Historical risk data for analysis
CREATE TABLE risk_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target VARCHAR(500) NOT NULL,
    assessment_date DATE NOT NULL,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    factors_count INTEGER DEFAULT 0,
    new_factors INTEGER DEFAULT 0,
    resolved_factors INTEGER DEFAULT 0,
    trend_direction VARCHAR(20) CHECK (trend_direction IN ('improving', 'stable', 'worsening')),
    change_amount INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk playbooks table - Automated response recommendations
CREATE TABLE risk_playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('social_media', 'dark_web', 'metadata', 'geolocation', 'domain', 'email', 'phone', 'financial', 'professional')),
    is_active BOOLEAN DEFAULT true,
    steps JSONB NOT NULL DEFAULT '[]',
    estimated_time_minutes INTEGER,
    difficulty_level VARCHAR(20) DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard', 'expert')),
    required_tools TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk alerts table - Notifications for significant risk changes
CREATE TABLE risk_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES risk_assessments(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('score_increase', 'score_decrease', 'new_factor', 'factor_resolved', 'threshold_breach')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'alert', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    risk_score_change INTEGER,
    previous_score INTEGER,
    current_score INTEGER,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk thresholds table - User-defined risk thresholds
CREATE TABLE risk_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('overall', 'social_media', 'dark_web', 'metadata', 'geolocation', 'domain', 'email', 'phone', 'financial', 'professional')),
    threshold_type VARCHAR(20) NOT NULL CHECK (threshold_type IN ('min', 'max', 'change')),
    value INTEGER NOT NULL CHECK (value >= 0 AND value <= 100),
    action VARCHAR(50) NOT NULL CHECK (action IN ('notify', 'alert', 'block', 'escalate')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default risk playbooks
INSERT INTO risk_playbooks (name, description, risk_level, category, steps, estimated_time_minutes, difficulty_level) VALUES
('Social Media Privacy Review', 'Review and update privacy settings on all social media platforms', 'medium', 'social_media',
 '["Review Facebook privacy settings", "Update Instagram account privacy", "Check Twitter account security", "Review LinkedIn profile visibility", "Update privacy settings on other platforms"]',
 30, 'easy'),

('Password Security Update', 'Update compromised passwords and enable 2FA', 'high', 'dark_web',
 '["Change compromised passwords", "Enable two-factor authentication", "Use password manager", "Check for password reuse", "Monitor for new breaches"]',
 45, 'medium'),

('Metadata Cleanup', 'Remove sensitive metadata from files and photos', 'medium', 'metadata',
 '["Strip EXIF data from photos", "Remove document metadata", "Use privacy tools", "Review file sharing settings", "Update privacy policies"]',
 60, 'medium'),

('Location Privacy Review', 'Review and update location sharing settings', 'low', 'geolocation',
 '["Disable GPS on photos", "Review app location permissions", "Update social media location settings", "Check travel pattern exposure", "Review check-in habits"]',
 20, 'easy');

-- Create indexes for better performance
CREATE INDEX idx_risk_assessments_user_id ON risk_assessments(user_id);
CREATE INDEX idx_risk_assessments_target ON risk_assessments(target);
CREATE INDEX idx_risk_assessments_risk_level ON risk_assessments(risk_level);
CREATE INDEX idx_risk_assessments_calculated_at ON risk_assessments(calculated_at);
CREATE INDEX idx_risk_factors_assessment_id ON risk_factors(assessment_id);
CREATE INDEX idx_risk_factors_category ON risk_factors(category);
CREATE INDEX idx_risk_factors_risk_score ON risk_factors(risk_score);
CREATE INDEX idx_risk_trends_user_id ON risk_trends(user_id);
CREATE INDEX idx_risk_trends_target ON risk_trends(target);
CREATE INDEX idx_risk_trends_assessment_date ON risk_trends(assessment_date);
CREATE INDEX idx_risk_trends_risk_score ON risk_trends(risk_score);
CREATE INDEX idx_risk_playbooks_risk_level ON risk_playbooks(risk_level);
CREATE INDEX idx_risk_playbooks_category ON risk_playbooks(category);
CREATE INDEX idx_risk_playbooks_is_active ON risk_playbooks(is_active);
CREATE INDEX idx_risk_alerts_user_id ON risk_alerts(user_id);
CREATE INDEX idx_risk_alerts_assessment_id ON risk_alerts(assessment_id);
CREATE INDEX idx_risk_alerts_severity ON risk_alerts(severity);
CREATE INDEX idx_risk_alerts_is_read ON risk_alerts(is_read);
CREATE INDEX idx_risk_alerts_created_at ON risk_alerts(created_at);
CREATE INDEX idx_risk_thresholds_user_id ON risk_thresholds(user_id);
CREATE INDEX idx_risk_thresholds_category ON risk_thresholds(category);
CREATE INDEX idx_risk_thresholds_is_active ON risk_thresholds(is_active);

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_risk_assessments_updated_at BEFORE UPDATE ON risk_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_playbooks_updated_at BEFORE UPDATE ON risk_playbooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_thresholds_updated_at BEFORE UPDATE ON risk_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

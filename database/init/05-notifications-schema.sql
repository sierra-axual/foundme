-- FoundMe Platform Notifications Schema
-- This script creates the tables for notification and alert management

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'sms', 'push', 'webhook', 'in_app')),
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
    recipient VARCHAR(500) NOT NULL,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification templates table
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'sms', 'push', 'webhook', 'in_app')),
    subject_template TEXT,
    message_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification preferences table
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'sms', 'push', 'webhook')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('security', 'scan_results', 'risk_alerts', 'billing', 'system', 'marketing')),
    is_enabled BOOLEAN DEFAULT true,
    frequency VARCHAR(20) DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    webhook_url VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, type, category)
);

-- Notification delivery logs table
CREATE TABLE notification_delivery_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    delivery_attempt INTEGER DEFAULT 1,
    provider VARCHAR(100),
    provider_message_id VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('attempted', 'sent', 'delivered', 'failed', 'bounced')),
    error_message TEXT,
    response_data JSONB DEFAULT '{}',
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

-- Notification schedules table
CREATE TABLE notification_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'sms', 'push', 'webhook')),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('one_time', 'recurring', 'interval')),
    schedule_data JSONB NOT NULL,
    next_run_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    max_runs INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default notification templates
INSERT INTO notification_templates (name, description, type, subject_template, message_template, variables) VALUES
('scan_complete', 'OSINT scan completion notification', 'email', 'OSINT Scan Complete - {{target}}', 
 'Your OSINT scan for {{target}} has been completed successfully. Risk Score: {{risk_score}}. View full results at {{dashboard_url}}.',
 '["target", "risk_score", "dashboard_url"]'),

('risk_alert', 'High risk alert notification', 'sms', NULL,
 'ALERT: High risk detected for {{target}}. Risk score: {{risk_score}}. Immediate action recommended.',
 '["target", "risk_score"]'),

('breach_detected', 'Data breach detection notification', 'email', 'Data Breach Detected - {{breach_name}}',
 'A new data breach has been detected involving {{breach_name}}. Your data may be affected. Risk level: {{risk_level}}.',
 '["breach_name", "risk_level", "affected_data"]'),

('subscription_renewal', 'Subscription renewal reminder', 'email', 'Subscription Renewal - {{plan_name}}',
 'Your {{plan_name}} subscription will renew on {{renewal_date}} for {{amount}}. Manage your subscription at {{billing_url}}.',
 '["plan_name", "renewal_date", "amount", "billing_url"]'),

('weekly_report', 'Weekly security report', 'email', 'Weekly Security Report - {{week_of}}',
 'Your weekly security report is ready. New findings: {{new_findings}}, Risk trend: {{risk_trend}}. View report at {{report_url}}.',
 '["week_of", "new_findings", "risk_trend", "report_url"]');

-- Note: Default notification preferences will be created when users register
-- No sample data inserted here to avoid foreign key constraint violations

-- Create indexes for better performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX idx_notification_templates_name ON notification_templates(name);
CREATE INDEX idx_notification_templates_type ON notification_templates(type);
CREATE INDEX idx_notification_templates_is_active ON notification_templates(is_active);
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_type ON notification_preferences(type);
CREATE INDEX idx_notification_preferences_category ON notification_preferences(category);
CREATE INDEX idx_notification_delivery_logs_notification_id ON notification_delivery_logs(notification_id);
CREATE INDEX idx_notification_delivery_logs_status ON notification_delivery_logs(status);
CREATE INDEX idx_notification_delivery_logs_provider ON notification_delivery_logs(provider);
CREATE INDEX idx_notification_schedules_user_id ON notification_schedules(user_id);
CREATE INDEX idx_notification_schedules_next_run_at ON notification_schedules(next_run_at);
CREATE INDEX idx_notification_schedules_is_active ON notification_schedules(is_active);

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_schedules_updated_at BEFORE UPDATE ON notification_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

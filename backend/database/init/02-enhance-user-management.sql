-- FoundMe Platform - Enhanced User Management Migration
-- Migration: 02-enhance-user-management.sql
-- Purpose: Add roles and permissions tables for enhanced user management

-- Roles table for role-based access control
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table for granular access control
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add role column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(100) DEFAULT 'user';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON roles(is_system);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_is_system ON permissions(is_system);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create trigger for roles table updated_at
CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for permissions table updated_at
CREATE TRIGGER update_permissions_updated_at 
    BEFORE UPDATE ON permissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default system roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
    ('admin', 'Full system administrator with all permissions', 
     ARRAY['user:read', 'user:write', 'user:delete', 'user:manage',
           'role:read', 'role:write', 'role:delete', 'role:manage',
           'permission:read', 'permission:write', 'permission:delete', 'permission:manage',
           'osint:read', 'osint:write', 'osint:delete', 'osint:manage',
           'system:read', 'system:write', 'system:delete', 'system:manage'], true),
    ('moderator', 'Moderator with limited administrative permissions',
     ARRAY['user:read', 'user:write',
           'osint:read', 'osint:write', 'osint:delete',
           'system:read'], true),
    ('user', 'Standard user with basic OSINT permissions',
     ARRAY['osint:read', 'osint:write'], true)
ON CONFLICT (name) DO NOTHING;

-- Insert default system permissions
INSERT INTO permissions (name, description, category, is_system) VALUES
    -- User management permissions
    ('user:read', 'Read user information', 'user_management', true),
    ('user:write', 'Create and update users', 'user_management', true),
    ('user:delete', 'Delete users', 'user_management', true),
    ('user:manage', 'Full user management', 'user_management', true),
    
    -- Role management permissions
    ('role:read', 'Read role information', 'role_management', true),
    ('role:write', 'Create and update roles', 'role_management', true),
    ('role:delete', 'Delete roles', 'role_management', true),
    ('role:manage', 'Full role management', 'role_management', true),
    
    -- Permission management permissions
    ('permission:read', 'Read permission information', 'permission_management', true),
    ('permission:write', 'Create and update permissions', 'permission_management', true),
    ('permission:delete', 'Delete permissions', 'permission_management', true),
    ('permission:manage', 'Full permission management', 'permission_management', true),
    
    -- OSINT permissions
    ('osint:read', 'Read OSINT data', 'osint', true),
    ('osint:write', 'Create and update OSINT data', 'osint', true),
    ('osint:delete', 'Delete OSINT data', 'osint', true),
    ('osint:manage', 'Full OSINT management', 'osint', true),
    
    -- System permissions
    ('system:read', 'Read system information', 'system', true),
    ('system:write', 'Update system settings', 'system', true),
    ('system:delete', 'Delete system data', 'system', true),
    ('system:manage', 'Full system management', 'system', true)
ON CONFLICT (name) DO NOTHING;

-- Update existing admin user to have admin role
UPDATE users SET role = 'admin' WHERE username = 'admin';

-- Add foreign key constraint for users.role -> roles.name
ALTER TABLE users ADD CONSTRAINT fk_users_role 
    FOREIGN KEY (role) REFERENCES roles(name) ON DELETE RESTRICT;

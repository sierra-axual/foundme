-- FoundMe Platform Database Initialization
-- This script creates the main database and user for the FoundMe platform

-- Create the main database
CREATE DATABASE foundme_dev;

-- Create the user with appropriate permissions
CREATE USER foundme_user WITH PASSWORD 'dev_password_secure_123';

-- Grant necessary permissions to the user
GRANT ALL PRIVILEGES ON DATABASE foundme_dev TO foundme_user;
GRANT CREATE ON DATABASE foundme_dev TO foundme_user;

-- Connect to the foundme_dev database
\c foundme_dev;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO foundme_user;
GRANT CREATE ON SCHEMA public TO foundme_user;

-- Set search path
SET search_path TO public;

-- Create extensions that might be needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant usage on extensions
GRANT USAGE ON SCHEMA public TO foundme_user;

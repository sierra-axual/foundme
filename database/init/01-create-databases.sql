-- FoundMe Platform Database Initialization
-- This script creates the main database and user

-- Create the main database
CREATE DATABASE foundme_dev
    WITH 
    OWNER = foundme_user
    ENCODING = 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE = 'C'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE foundme_dev TO foundme_user;

-- Connect to the foundme_dev database
\c foundme_dev;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
SET timezone = 'UTC';

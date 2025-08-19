-- FoundMe Platform Extensions Setup
-- This script enables required PostgreSQL extensions

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable additional useful extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search and similarity
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For GIN indexes on btree types
CREATE EXTENSION IF NOT EXISTS "hstore";   -- For key-value storage

-- Log extensions creation
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL extensions enabled successfully';
END $$;

// migrations/scripts/039-create-csrf-tokens-table.js

/**
 * Create CSRF tokens table for request forgery protection
 */

const createCSRFTokensTable = `
    CREATE TABLE IF NOT EXISTS csrf_tokens (
        id SERIAL PRIMARY KEY,
        token_key VARCHAR(255) NOT NULL,
        token_value VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

const createIndexes = `
    -- Index for efficient token key lookups
    CREATE INDEX IF NOT EXISTS idx_csrf_tokens_key ON csrf_tokens(token_key);
    
    -- Index for token value lookups
    CREATE INDEX IF NOT EXISTS idx_csrf_tokens_value ON csrf_tokens(token_value);
    
    -- Index for expiration cleanup
    CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens(expires_at);
    
    -- Unique constraint on key-value combination
    CREATE UNIQUE INDEX IF NOT EXISTS uk_csrf_tokens_key_value ON csrf_tokens(token_key, token_value);
`;

const addComments = `
    COMMENT ON TABLE csrf_tokens IS 'CSRF tokens for request forgery protection';
    COMMENT ON COLUMN csrf_tokens.id IS 'Primary key';
    COMMENT ON COLUMN csrf_tokens.token_key IS 'Unique identifier for the token (session, user, or anonymous hash)';
    COMMENT ON COLUMN csrf_tokens.token_value IS 'The actual CSRF token value';
    COMMENT ON COLUMN csrf_tokens.expires_at IS 'When this token expires';
    COMMENT ON COLUMN csrf_tokens.used IS 'Whether this token has been used (for one-time tokens)';
    COMMENT ON COLUMN csrf_tokens.created_at IS 'When this token was created';
`;

const setupCleanupFunction = `
    -- Function to clean up expired CSRF tokens
    CREATE OR REPLACE FUNCTION cleanup_expired_csrf_tokens()
    RETURNS INTEGER AS $$
    DECLARE
        deleted_count INTEGER;
    BEGIN
        DELETE FROM csrf_tokens 
        WHERE expires_at < CURRENT_TIMESTAMP;
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        
        -- Log cleanup activity
        INSERT INTO audit_logs (
            event_type,
            user_id,
            target_type,
            ip_address,
            metadata
        ) VALUES (
            'system.csrf_cleanup',
            NULL,
            'csrf_tokens',
            '127.0.0.1',
            json_build_object(
                'deleted_count', deleted_count,
                'cleanup_time', CURRENT_TIMESTAMP
            )
        );
        
        RETURN deleted_count;
    END;
    $$ LANGUAGE plpgsql;
`;

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Creating CSRF tokens table...');
            
            // Create the table
            await queryInterface.sequelize.query(createCSRFTokensTable, {
                transaction
            });
            
            // Create indexes
            await queryInterface.sequelize.query(createIndexes, {
                transaction
            });
            
            // Add comments
            await queryInterface.sequelize.query(addComments, {
                transaction
            });
            
            // Setup cleanup function
            await queryInterface.sequelize.query(setupCleanupFunction, {
                transaction
            });
            
            await transaction.commit();
            console.log('✅ CSRF tokens table created successfully');
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Failed to create CSRF tokens table:', error);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Dropping CSRF tokens table...');
            
            // Drop cleanup function
            await queryInterface.sequelize.query(
                'DROP FUNCTION IF EXISTS cleanup_expired_csrf_tokens();',
                { transaction }
            );
            
            // Drop table (indexes will be dropped automatically)
            await queryInterface.sequelize.query(
                'DROP TABLE IF EXISTS csrf_tokens;',
                { transaction }
            );
            
            await transaction.commit();
            console.log('✅ CSRF tokens table dropped successfully');
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Failed to drop CSRF tokens table:', error);
            throw error;
        }
    }
};
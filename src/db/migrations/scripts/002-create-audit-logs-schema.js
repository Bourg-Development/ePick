// db/migrations/002-create-audit-logs-schema.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Create audit_logs table
        await queryInterface.createTable('audit_logs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            event_type: {
                type: Sequelize.STRING(50),
                allowNull: false
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            target_id: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            target_type: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            ip_address: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            device_fingerprint: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            previous_hash: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            record_hash: {
                type: Sequelize.TEXT,
                allowNull: true
            }
        });

        // Create security_logs table
        await queryInterface.createTable('security_logs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            event_type: {
                type: Sequelize.STRING(50),
                allowNull: false
            },
            severity: {
                type: Sequelize.STRING(20),
                allowNull: false
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            ip_address: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            device_fingerprint: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            previous_hash: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            record_hash: {
                type: Sequelize.TEXT,
                allowNull: true
            }
        });

        // Add CHECK constraint for severity values
        await queryInterface.sequelize.query(
            `ALTER TABLE security_logs ADD CONSTRAINT check_severity_values CHECK (severity IN ('low', 'medium', 'high', 'critical'));`
        );

        // Create anomaly_detections table
        await queryInterface.createTable('anomaly_detections', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            anomaly_type: {
                type: Sequelize.STRING(50),
                allowNull: false
            },
            confidence: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            actions_taken: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            resolved: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            resolved_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            resolved_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            }
        });

        // Create rate_limits table
        await queryInterface.createTable('rate_limits', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            key_type: {
                type: Sequelize.STRING(20),
                allowNull: false
            },
            key_value: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            counter: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1
            },
            first_request: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            last_request: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            reset_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });

        // Add CHECK constraint for key_type values
        await queryInterface.sequelize.query(
            `ALTER TABLE rate_limits ADD CONSTRAINT check_key_type_values CHECK (key_type IN ('ip', 'user', 'service'));`
        );

        // Add unique constraint on key_type and key_value
        await queryInterface.addConstraint('rate_limits', {
            fields: ['key_type', 'key_value'],
            type: 'unique',
            name: 'rate_limits_key_type_key_value_key'
        });

        // Create indexes
        await queryInterface.addIndex('audit_logs', ['user_id']);
        await queryInterface.addIndex('audit_logs', ['event_type']);
        await queryInterface.addIndex('security_logs', ['ip_address']);
        await queryInterface.addIndex('security_logs', ['event_type']);
        await queryInterface.addIndex('anomaly_detections', ['user_id']);

        // Create function for log hashing
        await queryInterface.sequelize.query(`
            -- Create function for log hashing
            CREATE OR REPLACE FUNCTION hash_log_record()
            RETURNS TRIGGER AS $$
            DECLARE
                previous_record_hash TEXT;
                new_hash TEXT;
            BEGIN
                -- Get the hash of the previous record
                IF TG_TABLE_NAME = 'audit_logs' THEN
                    SELECT record_hash INTO previous_record_hash FROM audit_logs 
                    ORDER BY id DESC LIMIT 1;
                ELSIF TG_TABLE_NAME = 'security_logs' THEN
                    SELECT record_hash INTO previous_record_hash FROM security_logs 
                    ORDER BY id DESC LIMIT 1;
                END IF;
                
                -- Set the previous hash value
                NEW.previous_hash := previous_record_hash;
                
                -- Create a new hash from the current record + previous hash
                new_hash := encode(
                    digest(
                        COALESCE(previous_record_hash, '') || 
                        NEW.id::TEXT || 
                        NEW.event_type || 
                        COALESCE(NEW.user_id::TEXT, '') || 
                        COALESCE(NEW.ip_address, '') || 
                        NEW.created_at::TEXT,
                        'sha256'
                    ),
                    'hex'
                );
                
                NEW.record_hash := new_hash;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            
            -- Apply hash triggers to log tables
            CREATE TRIGGER hash_audit_log BEFORE INSERT ON audit_logs 
                FOR EACH ROW EXECUTE PROCEDURE hash_log_record();
            CREATE TRIGGER hash_security_log BEFORE INSERT ON security_logs 
                FOR EACH ROW EXECUTE PROCEDURE hash_log_record();
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Drop tables in reverse order
        await queryInterface.dropTable('rate_limits');
        await queryInterface.dropTable('anomaly_detections');
        await queryInterface.dropTable('security_logs');
        await queryInterface.dropTable('audit_logs');

        // Drop trigger functions
        await queryInterface.sequelize.query(`
            DROP FUNCTION IF EXISTS hash_log_record();
        `);
    }
};
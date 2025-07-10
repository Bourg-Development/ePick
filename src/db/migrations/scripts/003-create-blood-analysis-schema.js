// db/migrations/003-create-blood-analysis-schema.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Create organization_settings table
        await queryInterface.createTable('organization_settings', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            setting_key: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true
            },
            setting_value: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            data_type: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'string'
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updated_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            }
        });

        // Add CHECK constraint for data_type values
        await queryInterface.sequelize.query(
            `ALTER TABLE organization_settings ADD CONSTRAINT check_data_type_values CHECK (data_type IN ('string', 'integer', 'decimal', 'boolean', 'json'));`
        );

        // Create doctors table
        await queryInterface.createTable('doctors', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            specialization: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            phone: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            email: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            }
        });

        // Create rooms table with service_id instead of department
        await queryInterface.createTable('rooms', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            room_number: {
                type: Sequelize.STRING(4),
                allowNull: false,
                unique: true
            },
            service_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'services',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            capacity: {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: 1
            },
            active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            }
        });

        // Add CHECK constraint for room_number format (4 digits)
        await queryInterface.sequelize.query(
            `ALTER TABLE rooms ADD CONSTRAINT check_room_number_format CHECK (room_number ~ '^[0-9]{4}$');`
        );

        // Create patients table
        await queryInterface.createTable('patients', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            matricule_national: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true
            },
            date_of_birth: {
                type: Sequelize.DATE,
                allowNull: true
            },
            gender: {
                type: Sequelize.STRING(20),
                allowNull: true
            },
            phone: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            address: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            room_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'rooms',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            doctor_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'doctors',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            }
        });

        // Add CHECK constraint for gender values
        await queryInterface.sequelize.query(
            `ALTER TABLE patients ADD CONSTRAINT check_gender_values CHECK (gender IN ('Male', 'Female', 'Other'));`
        );

        // Create analyses table
        await queryInterface.createTable('analyses', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            analysis_date: {
                type: Sequelize.DATE,
                allowNull: false
            },
            patient_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'patients',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            doctor_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'doctors',
                    key: 'id'
                },
                onDelete: 'RESTRICT'
            },
            room_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'rooms',
                    key: 'id'
                },
                onDelete: 'RESTRICT'
            },
            status: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'Pending'
            },
            analysis_type: {
                type: Sequelize.STRING(10),
                allowNull: false
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            completed_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            postponed_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            original_date: {
                type: Sequelize.DATE,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'RESTRICT'
            },
            completed_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            }
        });

        // Add CHECK constraints for analyses
        await queryInterface.sequelize.query(`
            ALTER TABLE analyses ADD CONSTRAINT check_status_values
                CHECK (status IN ('Pending', 'Delayed', 'In Progress', 'Completed', 'Cancelled'));
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE analyses ADD CONSTRAINT check_analysis_type_values
                CHECK (analysis_type IN ('XY', 'YZ', 'ZG', 'HG'));
        `);

        // Create archived_analyses table
        await queryInterface.createTable('archived_analyses', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            original_analysis_id: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            analysis_date: {
                type: Sequelize.DATE,
                allowNull: false
            },
            patient_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'patients',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            patient_name: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            doctor_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'doctors',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            doctor_name: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            room_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'rooms',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            room_number: {
                type: Sequelize.STRING(4),
                allowNull: false
            },
            status: {
                type: Sequelize.STRING(20),
                allowNull: false
            },
            analysis_type: {
                type: Sequelize.STRING(10),
                allowNull: false
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            completed_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            postponed_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            original_date: {
                type: Sequelize.DATE,
                allowNull: true
            },
            archived_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            archived_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'RESTRICT'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            completed_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            }
        });

        // Create indexes for better performance
        await queryInterface.addIndex('organization_settings', ['setting_key']);
        await queryInterface.addIndex('doctors', ['name']);
        await queryInterface.addIndex('doctors', ['active']);
        await queryInterface.addIndex('rooms', ['room_number']);
        await queryInterface.addIndex('rooms', ['service_id']);
        await queryInterface.addIndex('rooms', ['active']);
        await queryInterface.addIndex('patients', ['matricule_national']);
        await queryInterface.addIndex('patients', ['name']);
        await queryInterface.addIndex('patients', ['doctor_id']);
        await queryInterface.addIndex('patients', ['room_id']);
        await queryInterface.addIndex('patients', ['active']);
        await queryInterface.addIndex('analyses', ['analysis_date']);
        await queryInterface.addIndex('analyses', ['patient_id']);
        await queryInterface.addIndex('analyses', ['doctor_id']);
        await queryInterface.addIndex('analyses', ['room_id']);
        await queryInterface.addIndex('analyses', ['status']);
        await queryInterface.addIndex('analyses', ['analysis_type']);
        await queryInterface.addIndex('analyses', ['created_by']);
        await queryInterface.addIndex('analyses', {
            fields: ['room_id', 'analysis_date'],
            name: 'idx_analyses_room_date'
        });
        await queryInterface.addIndex('archived_analyses', ['original_analysis_id']);
        await queryInterface.addIndex('archived_analyses', ['analysis_date']);
        await queryInterface.addIndex('archived_analyses', ['patient_id']);
        await queryInterface.addIndex('archived_analyses', ['archived_at']);

        // Apply timestamp triggers to new tables
        await queryInterface.sequelize.query(`
            CREATE TRIGGER update_organization_settings_timestamp BEFORE UPDATE ON organization_settings 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
            CREATE TRIGGER update_doctors_timestamp BEFORE UPDATE ON doctors 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
            CREATE TRIGGER update_rooms_timestamp BEFORE UPDATE ON rooms 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
            CREATE TRIGGER update_patients_timestamp BEFORE UPDATE ON patients 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
            CREATE TRIGGER update_analyses_timestamp BEFORE UPDATE ON analyses 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
        `);

        // Create a function to automatically archive completed analyses older than today
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION archive_old_analyses()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Only archive if status is 'Completed' and analysis_date is older than today
                IF NEW.status = 'Completed' AND NEW.analysis_date < CURRENT_DATE THEN
                    INSERT INTO archived_analyses (
                        original_analysis_id, analysis_date, patient_id, patient_name,
                        doctor_id, doctor_name, room_id, room_number, status, analysis_type,
                        notes, completed_at, postponed_count,
                        original_date, archived_by, created_at, created_by, completed_by
                    )
                    SELECT 
                        NEW.id, NEW.analysis_date, NEW.patient_id, p.name,
                        NEW.doctor_id, d.name, NEW.room_id, r.room_number, NEW.status, NEW.analysis_type,
                        NEW.notes, NEW.completed_at, NEW.postponed_count,
                        NEW.original_date, NEW.completed_by, NEW.created_at, NEW.created_by, NEW.completed_by
                    FROM patients p, doctors d, rooms r
                    WHERE p.id = NEW.patient_id AND d.id = NEW.doctor_id AND r.id = NEW.room_id;
                    
                    -- Delete the original analysis after archiving
                    DELETE FROM analyses WHERE id = NEW.id;
                    RETURN NULL; -- Don't proceed with the original update
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            
            -- Create trigger for auto-archiving
            CREATE TRIGGER auto_archive_analyses 
                AFTER UPDATE ON analyses 
                FOR EACH ROW EXECUTE PROCEDURE archive_old_analyses();
        `);

    },

    down: async (queryInterface, Sequelize) => {
        // Drop functions first
        await queryInterface.sequelize.query(`
            DROP FUNCTION IF EXISTS get_analysis_statistics_for_service(DATE, DATE, INTEGER);
        `);

        // Drop tables in reverse order
        await queryInterface.dropTable('archived_analyses');
        await queryInterface.dropTable('analyses');
        await queryInterface.dropTable('patients');
        await queryInterface.dropTable('rooms');
        await queryInterface.dropTable('doctors');
        await queryInterface.dropTable('organization_settings');

        // Drop trigger functions
        await queryInterface.sequelize.query(`
            DROP FUNCTION IF EXISTS archive_old_analyses();
        `);
    }
};
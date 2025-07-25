// db/migrations/scripts/038-fix-cancelled-archive-date-logic.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Update the archive function to use date comparison instead of timestamp
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION archive_old_cancelled_analyses()
            RETURNS INTEGER AS $$
            DECLARE
                cancelled_delay_days INTEGER;
                archived_count INTEGER := 0;
                analysis_record RECORD;
            BEGIN
                -- Get the cancelled analysis archive delay from organization settings
                SELECT COALESCE(
                    (SELECT CAST(setting_value AS INTEGER) 
                     FROM organization_settings 
                     WHERE setting_key = 'cancelled_analysis_archive_delay'), 
                    1
                ) INTO cancelled_delay_days;

                -- Find cancelled analyses that are old enough to archive
                -- Use date comparison: updated_at::date < CURRENT_DATE - interval
                -- This means anything cancelled yesterday (regardless of time) will be archived today
                FOR analysis_record IN 
                    SELECT a.*, p.name as patient_name, d.name as doctor_name, r.room_number
                    FROM analyses a
                    JOIN patients p ON a.patient_id = p.id
                    JOIN doctors d ON a.doctor_id = d.id
                    JOIN rooms r ON a.room_id = r.id
                    WHERE a.status = 'Cancelled' 
                    AND a.updated_at::date < CURRENT_DATE - (cancelled_delay_days || ' days')::INTERVAL
                LOOP
                    -- Archive the cancelled analysis
                    INSERT INTO archived_analyses (
                        original_analysis_id, analysis_date, patient_id, patient_name,
                        doctor_id, doctor_name, room_id, room_number, status, analysis_type,
                        notes, completed_at, postponed_count,
                        original_date, archived_by, created_at, created_by, completed_by
                    ) VALUES (
                        analysis_record.id, analysis_record.analysis_date, analysis_record.patient_id, analysis_record.patient_name,
                        analysis_record.doctor_id, analysis_record.doctor_name, analysis_record.room_id, analysis_record.room_number, 
                        analysis_record.status, analysis_record.analysis_type,
                        analysis_record.notes, analysis_record.completed_at, analysis_record.postponed_count,
                        analysis_record.original_date, 1, analysis_record.created_at, analysis_record.created_by, analysis_record.completed_by
                    );
                    
                    -- Delete the original analysis
                    DELETE FROM analyses WHERE id = analysis_record.id;
                    
                    archived_count := archived_count + 1;
                END LOOP;

                RETURN archived_count;
            END;
            $$ LANGUAGE plpgsql;
        `);

        console.log('Updated archive function to use date-based comparison');
    },

    down: async (queryInterface, Sequelize) => {
        // Revert to timestamp-based comparison
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION archive_old_cancelled_analyses()
            RETURNS INTEGER AS $$
            DECLARE
                cancelled_delay_days INTEGER;
                archived_count INTEGER := 0;
                analysis_record RECORD;
            BEGIN
                -- Get the cancelled analysis archive delay from organization settings
                SELECT COALESCE(
                    (SELECT CAST(setting_value AS INTEGER) 
                     FROM organization_settings 
                     WHERE setting_key = 'cancelled_analysis_archive_delay'), 
                    1
                ) INTO cancelled_delay_days;

                -- Find cancelled analyses that are old enough to archive
                FOR analysis_record IN 
                    SELECT a.*, p.name as patient_name, d.name as doctor_name, r.room_number
                    FROM analyses a
                    JOIN patients p ON a.patient_id = p.id
                    JOIN doctors d ON a.doctor_id = d.id
                    JOIN rooms r ON a.room_id = r.id
                    WHERE a.status = 'Cancelled' 
                    AND a.updated_at < CURRENT_DATE - (cancelled_delay_days || ' days')::INTERVAL
                LOOP
                    -- Archive the cancelled analysis
                    INSERT INTO archived_analyses (
                        original_analysis_id, analysis_date, patient_id, patient_name,
                        doctor_id, doctor_name, room_id, room_number, status, analysis_type,
                        notes, completed_at, postponed_count,
                        original_date, archived_by, created_at, created_by, completed_by
                    ) VALUES (
                        analysis_record.id, analysis_record.analysis_date, analysis_record.patient_id, analysis_record.patient_name,
                        analysis_record.doctor_id, analysis_record.doctor_name, analysis_record.room_id, analysis_record.room_number, 
                        analysis_record.status, analysis_record.analysis_type,
                        analysis_record.notes, analysis_record.completed_at, analysis_record.postponed_count,
                        analysis_record.original_date, 1, analysis_record.created_at, analysis_record.created_by, analysis_record.completed_by
                    );
                    
                    -- Delete the original analysis
                    DELETE FROM analyses WHERE id = analysis_record.id;
                    
                    archived_count := archived_count + 1;
                END LOOP;

                RETURN archived_count;
            END;
            $$ LANGUAGE plpgsql;
        `);
    }
};
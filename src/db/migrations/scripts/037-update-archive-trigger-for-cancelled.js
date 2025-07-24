// db/migrations/scripts/037-update-archive-trigger-for-cancelled.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Update the archive function to handle both completed and cancelled analyses
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION archive_old_analyses()
            RETURNS TRIGGER AS $$
            DECLARE
                cancelled_delay_days INTEGER;
            BEGIN
                -- Get the cancelled analysis archive delay from organization settings
                SELECT COALESCE(
                    (SELECT CAST(setting_value AS INTEGER) 
                     FROM organization_settings 
                     WHERE setting_key = 'cancelled_analysis_archive_delay'), 
                    1
                ) INTO cancelled_delay_days;

                -- Archive completed analyses if older than today
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
                    RETURN NULL;
                END IF;

                -- Archive cancelled analyses if cancelled for the configured number of days
                IF NEW.status = 'Cancelled' AND OLD.status != 'Cancelled' THEN
                    -- This is a new cancellation, check if it should be archived based on its age
                    -- For newly cancelled analyses, we need to check if they're old enough
                    NULL; -- We'll handle this in a scheduled job instead
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create a function to archive old cancelled analyses (to be called by scheduled job)
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
    },

    down: async (queryInterface, Sequelize) => {
        // Revert to the original archive function (only completed analyses)
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
                    RETURN NULL;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Drop the new function
        await queryInterface.sequelize.query(`
            DROP FUNCTION IF EXISTS archive_old_cancelled_analyses();
        `);
    }
};
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Create a function to archive old completed analyses (to be called by scheduled job)
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION archive_old_completed_analyses()
            RETURNS INTEGER AS $$
            DECLARE
                archived_count INTEGER := 0;
                analysis_record RECORD;
                auto_archive_enabled BOOLEAN;
            BEGIN
                -- Check if auto-archiving is enabled
                SELECT COALESCE(
                    (SELECT CAST(setting_value AS BOOLEAN) 
                     FROM organization_settings 
                     WHERE setting_key = 'auto_archive_enabled'), 
                    false
                ) INTO auto_archive_enabled;

                -- Return 0 if auto-archiving is disabled
                IF NOT auto_archive_enabled THEN
                    RETURN 0;
                END IF;

                -- Find completed analyses that are older than today
                FOR analysis_record IN 
                    SELECT a.*, p.name as patient_name, d.name as doctor_name, r.room_number
                    FROM analyses a
                    JOIN patients p ON a.patient_id = p.id
                    JOIN doctors d ON a.doctor_id = d.id
                    JOIN rooms r ON a.room_id = r.id
                    WHERE a.status = 'Completed' 
                    AND a.analysis_date < CURRENT_DATE
                LOOP
                    -- Archive the completed analysis
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
        // Drop the function
        await queryInterface.sequelize.query(`
            DROP FUNCTION IF EXISTS archive_old_completed_analyses();
        `);
    }
};
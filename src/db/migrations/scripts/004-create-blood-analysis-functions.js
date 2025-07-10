// db/migrations/004-create-blood-analysis-functions.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Create function to get organization setting value
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION get_organization_setting(setting_name TEXT)
            RETURNS TEXT AS $$
            DECLARE
                setting_value TEXT;
            BEGIN
                SELECT os.setting_value INTO setting_value 
                FROM organization_settings os 
                WHERE os.setting_key = setting_name;
                
                RETURN setting_value;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create function to count analyses for a specific date (global)
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION count_analyses_for_date(target_date DATE)
            RETURNS INTEGER AS $$
            DECLARE
                analysis_count INTEGER;
            BEGIN
                SELECT COUNT(*) INTO analysis_count 
                FROM analyses 
                WHERE DATE(analysis_date) = target_date 
                AND status IN ('Pending', 'Delayed', 'In Progress');
                
                RETURN analysis_count;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // NEW: Create function to count analyses for a specific service and date
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION count_analyses_for_service_and_date(
                p_service_id INTEGER, 
                target_date DATE
            )
            RETURNS INTEGER AS $$
            DECLARE
                analysis_count INTEGER;
            BEGIN
                SELECT COUNT(*) INTO analysis_count 
                FROM analyses a
                INNER JOIN rooms r ON a.room_id = r.id
                WHERE r.service_id = p_service_id
                AND DATE(a.analysis_date) = target_date 
                AND a.status IN ('Pending', 'Delayed', 'In Progress');
                
                RETURN analysis_count;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create function to find next available date for analysis scheduling (global)
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION find_next_available_date(start_date DATE DEFAULT CURRENT_DATE)
            RETURNS DATE AS $$
            DECLARE
                max_analyses_per_day INTEGER;
                check_date DATE;
                analyses_count INTEGER;
                working_days JSONB;
                day_name TEXT;
            BEGIN
                -- Get the maximum analyses per day setting
                SELECT CAST(get_organization_setting('max_analyses_per_day') AS INTEGER) 
                INTO max_analyses_per_day;
                
                -- Get working days setting
                SELECT CAST(get_organization_setting('working_days') AS JSONB) 
                INTO working_days;
                
                -- If no limit is set, return the start date
                IF max_analyses_per_day IS NULL THEN
                    RETURN start_date;
                END IF;
                
                -- Start checking from the given date
                check_date := start_date;
                
                -- Loop until we find an available date (max 30 days to prevent infinite loop)
                FOR i IN 1..30 LOOP
                    -- Get the day name for the current check_date
                    day_name := TO_CHAR(check_date, 'Day');
                    day_name := TRIM(day_name);
                    
                    -- Check if this day is a working day
                    IF working_days ? day_name THEN
                        -- Count existing analyses for this date
                        SELECT count_analyses_for_date(check_date) INTO analyses_count;
                        
                        -- If we have capacity, return this date
                        IF analyses_count < max_analyses_per_day THEN
                            RETURN check_date;
                        END IF;
                    END IF;
                    
                    -- Move to next day
                    check_date := check_date + INTERVAL '1 day';
                END LOOP;
                
                -- If no date found in 30 days, return 30 days from start_date
                RETURN start_date + INTERVAL '30 days';
            END;
            $$ LANGUAGE plpgsql;
        `);

        // NEW: Create function to find next available date for a specific service
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION find_next_available_date_for_service(
                p_service_id INTEGER,
                start_date DATE DEFAULT CURRENT_DATE
            )
            RETURNS DATE AS $$
            DECLARE
                max_analyses_per_day INTEGER;
                check_date DATE;
                analyses_count INTEGER;
                working_days JSONB;
                day_name TEXT;
            BEGIN
                -- Get the maximum analyses per day setting
                SELECT CAST(get_organization_setting('max_analyses_per_day') AS INTEGER) 
                INTO max_analyses_per_day;
                
                -- Get working days setting
                SELECT CAST(get_organization_setting('working_days') AS JSONB) 
                INTO working_days;
                
                -- If no limit is set, return the start date
                IF max_analyses_per_day IS NULL THEN
                    RETURN start_date;
                END IF;
                
                -- Start checking from the given date
                check_date := start_date;
                
                -- Loop until we find an available date (max 30 days to prevent infinite loop)
                FOR i IN 1..30 LOOP
                    -- Get the day name for the current check_date
                    day_name := TO_CHAR(check_date, 'Day');
                    day_name := TRIM(day_name);
                    
                    -- Check if this day is a working day
                    IF working_days ? day_name THEN
                        -- Count existing analyses for this service and date
                        SELECT count_analyses_for_service_and_date(p_service_id, check_date) 
                        INTO analyses_count;
                        
                        -- If we have capacity for this service, return this date
                        IF analyses_count < max_analyses_per_day THEN
                            RETURN check_date;
                        END IF;
                    END IF;
                    
                    -- Move to next day
                    check_date := check_date + INTERVAL '1 day';
                END LOOP;
                
                -- If no date found in 30 days, return 30 days from start_date
                RETURN start_date + INTERVAL '30 days';
            END;
            $$ LANGUAGE plpgsql;
        `);

        // NEW: Create function to postpone an analysis considering service-specific limits
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION postpone_analysis_by_service(
                analysis_id INTEGER,
                user_id INTEGER DEFAULT NULL
            )
            RETURNS DATE AS $$
            DECLARE
                current_analysis RECORD;
                analysis_service_id INTEGER;
                new_date DATE;
            BEGIN
                -- Get the current analysis details
                SELECT * INTO current_analysis 
                FROM analyses 
                WHERE id = analysis_id;
                
                -- Get the service_id for this analysis
                SELECT r.service_id INTO analysis_service_id
                FROM analyses a
                INNER JOIN rooms r ON a.room_id = r.id
                WHERE a.id = analysis_id;
                
                -- Check if analysis exists
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Analysis with ID % not found', analysis_id;
                END IF;
                
                -- Check if analysis can be postponed
                IF current_analysis.status IN ('Completed', 'Cancelled') THEN
                    RAISE EXCEPTION 'Cannot postpone analysis with status %', current_analysis.status;
                END IF;
                
                -- Find the next available date for this service (cast to DATE)
                new_date := find_next_available_date_for_service(
                    analysis_service_id, 
                    (current_analysis.analysis_date + INTERVAL '1 day')::DATE
                );
                
                -- Store original date if this is the first postponement
                IF current_analysis.original_date IS NULL THEN
                    UPDATE analyses 
                    SET original_date = current_analysis.analysis_date
                    WHERE id = analysis_id;
                END IF;
                
                -- Update the analysis
                UPDATE analyses 
                SET 
                    analysis_date = new_date,
                    status = 'Delayed',
                    postponed_count = postponed_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = analysis_id;
                
                -- Log the postponement in audit_logs
                INSERT INTO audit_logs (
                    event_type, user_id, target_id, target_type, 
                    metadata, created_at
                ) VALUES (
                    'analysis_postponed', user_id, analysis_id, 'analysis',
                    json_build_object(
                        'from_date', current_analysis.analysis_date,
                        'to_date', new_date,
                        'postponed_count', current_analysis.postponed_count + 1,
                        'service_id', analysis_service_id,
                        'method', 'service_specific'
                    ),
                    CURRENT_TIMESTAMP
                );
                
                RETURN new_date;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create function to check for scheduling conflicts
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION check_room_scheduling_conflict(
                target_date DATE, 
                room_id INTEGER, 
                exclude_analysis_id INTEGER DEFAULT NULL
            ) RETURNS BOOLEAN
            LANGUAGE plpgsql
            AS
            $$
            DECLARE
                conflict_count INTEGER;
            BEGIN
                SELECT COUNT(*) INTO conflict_count
                FROM analyses 
                WHERE DATE(analysis_date) = target_date
                AND analyses.room_id = check_room_scheduling_conflict.room_id
                AND status IN ('Pending', 'Delayed', 'In Progress')
                AND (exclude_analysis_id IS NULL OR id != exclude_analysis_id);
                
                RETURN conflict_count > 0;
            END;
            $$;
        `);

        // NEW: Create function to check service capacity for a date
        await queryInterface.sequelize.query(`
            CREATE OR REPLACE FUNCTION check_service_capacity_for_date(
                p_service_id INTEGER,
                target_date DATE
            )
            RETURNS BOOLEAN AS $$
            DECLARE
                max_analyses_per_day INTEGER;
                current_count INTEGER;
            BEGIN
                -- Get the maximum analyses per day setting
                SELECT CAST(get_organization_setting('max_analyses_per_day') AS INTEGER) 
                INTO max_analyses_per_day;
                
                -- If no limit is set, always return true (unlimited capacity)
                IF max_analyses_per_day IS NULL THEN
                    RETURN true;
                END IF;
                
                -- Get current count for the service and date
                SELECT count_analyses_for_service_and_date(p_service_id, target_date)
                INTO current_count;
                
                -- Return true if under capacity, false if at or over capacity
                RETURN current_count < max_analyses_per_day;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await queryInterface.sequelize.query(`
            CREATE VIEW analysis_dashboard AS
            SELECT 
                a.id,
                a.analysis_date,
                a.status,
                a.analysis_type,
                a.postponed_count,
                p.name as patient_name,
                p.matricule_national,
                d.name as doctor_name,
                r.room_number,
                r.service_id as room_service_id,
                s.name as service_name,
                a.created_at,
                CASE 
                    WHEN a.analysis_date < CURRENT_DATE AND a.status IN ('Pending', 'Delayed') THEN true
                    ELSE false
                END as is_overdue,
                CASE 
                    WHEN a.analysis_date = CURRENT_DATE AND a.status IN ('Pending', 'Delayed') THEN true
                    ELSE false
                END as is_today
            FROM analyses a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            JOIN rooms r ON a.room_id = r.id
            LEFT JOIN services s ON r.service_id = s.id
            WHERE a.status IN ('Pending', 'Delayed', 'In Progress')
            ORDER BY 
                a.analysis_date ASC;
        `);

        await queryInterface.sequelize.query(`
            CREATE OR REPLACE VIEW patient_analysis_history AS
            SELECT 
                p.id as patient_id,
                p.name as patient_name,
                p.matricule_national,
                COUNT(a.id) as total_analyses,
                COUNT(a.id) FILTER (WHERE a.status = 'Completed') as completed_analyses,
                COUNT(a.id) FILTER (WHERE a.status IN ('Pending', 'Delayed')) as pending_analyses,
                MAX(a.analysis_date) as last_analysis_date,
                AVG(a.postponed_count) as avg_postponements
            FROM patients p
            LEFT JOIN analyses a ON p.id = a.patient_id
            GROUP BY p.id, p.name, p.matricule_national;
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Drop views
        await queryInterface.sequelize.query('DROP VIEW IF EXISTS patient_analysis_history;');
        await queryInterface.sequelize.query('DROP VIEW IF EXISTS analysis_dashboard;');

        // Drop functions
        await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS check_service_capacity_for_date(INTEGER, DATE);');
        await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS check_room_scheduling_conflict(DATE, INTEGER, INTEGER);');
        await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS postpone_analysis_by_service(INTEGER, INTEGER);');
        await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS find_next_available_date_for_service(INTEGER, DATE);');
        await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS find_next_available_date(DATE);');
        await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS count_analyses_for_service_and_date(INTEGER, DATE);');
        await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS count_analyses_for_date(DATE);');
        await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS get_organization_setting(TEXT);');
    }
};
// migrations/scripts/023-increase-encrypted-column-sizes.js

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Increasing column sizes for encrypted fields...');
            
            // Drop views that depend on these columns
            console.log('Dropping dependent views...');
            await queryInterface.sequelize.query(
                'DROP VIEW IF EXISTS analysis_dashboard CASCADE',
                { transaction }
            );
            await queryInterface.sequelize.query(
                'DROP VIEW IF EXISTS patient_analysis_history CASCADE',
                { transaction }
            );
            
            // Patients table - increase encrypted field sizes
            await queryInterface.changeColumn('patients', 'name', {
                type: Sequelize.TEXT, // Change from VARCHAR(255) to TEXT
                allowNull: false
            }, { transaction });
            
            await queryInterface.changeColumn('patients', 'matricule_national', {
                type: Sequelize.TEXT, // Change from VARCHAR(50) to TEXT
                allowNull: false,
                unique: true
            }, { transaction });
            
            await queryInterface.changeColumn('patients', 'phone', {
                type: Sequelize.TEXT, // Change from VARCHAR(50) to TEXT
                allowNull: true
            }, { transaction });
            
            // address is already TEXT, no change needed
            
            // Doctors table - increase encrypted field sizes
            await queryInterface.changeColumn('doctors', 'name', {
                type: Sequelize.TEXT, // Change from VARCHAR(255) to TEXT
                allowNull: false
            }, { transaction });
            
            await queryInterface.changeColumn('doctors', 'phone', {
                type: Sequelize.TEXT, // Change from VARCHAR(50) to TEXT
                allowNull: true
            }, { transaction });
            
            await queryInterface.changeColumn('doctors', 'email', {
                type: Sequelize.TEXT, // Change from VARCHAR(255) to TEXT
                allowNull: true
            }, { transaction });
            
            await queryInterface.changeColumn('doctors', 'specialization', {
                type: Sequelize.TEXT, // Change from VARCHAR(255) to TEXT
                allowNull: true
            }, { transaction });
            
            // ArchivedAnalysis table - increase encrypted field sizes
            await queryInterface.changeColumn('archived_analyses', 'patient_name', {
                type: Sequelize.TEXT, // Change from VARCHAR(255) to TEXT
                allowNull: false
            }, { transaction });
            
            await queryInterface.changeColumn('archived_analyses', 'doctor_name', {
                type: Sequelize.TEXT, // Change from VARCHAR(255) to TEXT
                allowNull: false
            }, { transaction });
            
            // notes and results are already TEXT, no change needed
            
            // Prescriptions table - increase encrypted field sizes
            await queryInterface.changeColumn('prescriptions', 'prescription_number', {
                type: Sequelize.TEXT, // Change from VARCHAR(50) to TEXT
                allowNull: false
            }, { transaction });
            
            await queryInterface.changeColumn('prescriptions', 'document_path', {
                type: Sequelize.TEXT, // Change from VARCHAR(500) to TEXT
                allowNull: true
            }, { transaction });
            
            await queryInterface.changeColumn('prescriptions', 'document_filename', {
                type: Sequelize.TEXT, // Change from VARCHAR(255) to TEXT
                allowNull: true
            }, { transaction });
            
            // notes is already TEXT, no change needed
            
            // Analysis table - notes is already TEXT, no change needed
            
            // Recreate the analysis_dashboard view
            console.log('Recreating analysis_dashboard view...');
            await queryInterface.sequelize.query(`
                CREATE VIEW analysis_dashboard AS
                SELECT 
                    a.id,
                    a.created_at,
                    a.updated_at,
                    a.status,
                    a.analysis_type,
                    a.notes,
                    p.name AS patient_name,
                    p.matricule_national,
                    p.gender,
                    p.date_of_birth,
                    d.name AS doctor_name,
                    d.specialization,
                    u.full_name AS created_by_name,
                    u2.full_name AS completed_by_name,
                    r.room_number AS room_name
                FROM analyses a
                LEFT JOIN patients p ON a.patient_id = p.id
                LEFT JOIN doctors d ON a.doctor_id = d.id
                LEFT JOIN users u ON a.created_by = u.id
                LEFT JOIN users u2 ON a.completed_by = u2.id
                LEFT JOIN rooms r ON a.room_id = r.id
            `, { transaction });
            
            // Recreate the patient_analysis_history view
            console.log('Recreating patient_analysis_history view...');
            await queryInterface.sequelize.query(`
                CREATE VIEW patient_analysis_history AS
                SELECT 
                    p.id AS patient_id,
                    p.name AS patient_name,
                    p.matricule_national,
                    p.gender,
                    p.date_of_birth,
                    COUNT(a.id) AS total_analyses,
                    MAX(a.created_at) AS last_analysis_date,
                    STRING_AGG(DISTINCT a.analysis_type, ', ') AS analysis_types
                FROM patients p
                LEFT JOIN analyses a ON p.id = a.patient_id
                GROUP BY p.id, p.name, p.matricule_national, p.gender, p.date_of_birth
            `, { transaction });
            
            await transaction.commit();
            console.log('Successfully increased column sizes for encrypted fields!');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error increasing column sizes:', error);
            throw error;
        }
    },
    
    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Reverting column sizes for encrypted fields...');
            
            // Note: This rollback may truncate data if encrypted values are longer
            // than the original column sizes. Use with caution.
            
            // Patients table - revert to original sizes
            await queryInterface.changeColumn('patients', 'name', {
                type: Sequelize.STRING(255),
                allowNull: false
            }, { transaction });
            
            await queryInterface.changeColumn('patients', 'matricule_national', {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true
            }, { transaction });
            
            await queryInterface.changeColumn('patients', 'phone', {
                type: Sequelize.STRING(50),
                allowNull: true
            }, { transaction });
            
            // Doctors table - revert to original sizes
            await queryInterface.changeColumn('doctors', 'name', {
                type: Sequelize.STRING(255),
                allowNull: false
            }, { transaction });
            
            await queryInterface.changeColumn('doctors', 'phone', {
                type: Sequelize.STRING(50),
                allowNull: true
            }, { transaction });
            
            await queryInterface.changeColumn('doctors', 'email', {
                type: Sequelize.STRING(255),
                allowNull: true
            }, { transaction });
            
            await queryInterface.changeColumn('doctors', 'specialization', {
                type: Sequelize.STRING(255),
                allowNull: true
            }, { transaction });
            
            // ArchivedAnalysis table - revert to original sizes
            await queryInterface.changeColumn('archived_analyses', 'patient_name', {
                type: Sequelize.STRING(255),
                allowNull: false
            }, { transaction });
            
            await queryInterface.changeColumn('archived_analyses', 'doctor_name', {
                type: Sequelize.STRING(255),
                allowNull: false
            }, { transaction });
            
            // Prescriptions table - revert to original sizes
            await queryInterface.changeColumn('prescriptions', 'prescription_number', {
                type: Sequelize.STRING(50),
                allowNull: false
            }, { transaction });
            
            await queryInterface.changeColumn('prescriptions', 'document_path', {
                type: Sequelize.STRING(500),
                allowNull: true
            }, { transaction });
            
            await queryInterface.changeColumn('prescriptions', 'document_filename', {
                type: Sequelize.STRING(255),
                allowNull: true
            }, { transaction });
            
            await transaction.commit();
            console.log('Successfully reverted column sizes!');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error reverting column sizes:', error);
            throw error;
        }
    }
};
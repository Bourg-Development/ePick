// Migration: Separate patient names into first_name and last_name fields

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Adding first_name and last_name columns to patients table...');
            
            // Add new columns
            await queryInterface.addColumn('patients', 'first_name', {
                type: Sequelize.STRING(100),
                allowNull: true
            }, { transaction });
            
            await queryInterface.addColumn('patients', 'last_name', {
                type: Sequelize.STRING(100),
                allowNull: true
            }, { transaction });
            
            console.log('Migrating existing name data...');
            
            // Get all existing patients
            const patients = await queryInterface.sequelize.query(
                'SELECT id, name FROM patients WHERE name IS NOT NULL AND name != \'\'',
                { 
                    type: Sequelize.QueryTypes.SELECT,
                    transaction 
                }
            );
            
            // Update each patient's name data
            for (const patient of patients) {
                if (patient.name) {
                    const nameParts = patient.name.trim().split(/\s+/);
                    let firstName = '';
                    let lastName = '';
                    
                    if (nameParts.length === 1) {
                        // Single name - treat as first name
                        firstName = nameParts[0];
                        lastName = '';
                    } else if (nameParts.length === 2) {
                        // Two parts - first and last
                        firstName = nameParts[0];
                        lastName = nameParts[1];
                    } else {
                        // Multiple parts - first word is first name, rest is last name
                        firstName = nameParts[0];
                        lastName = nameParts.slice(1).join(' ');
                    }
                    
                    await queryInterface.sequelize.query(
                        'UPDATE patients SET first_name = :firstName, last_name = :lastName WHERE id = :id',
                        {
                            replacements: {
                                firstName,
                                lastName,
                                id: patient.id
                            },
                            type: Sequelize.QueryTypes.UPDATE,
                            transaction
                        }
                    );
                }
            }
            
            console.log(`Updated ${patients.length} patient records with separated names`);
            
            // Make first_name required after migration
            await queryInterface.changeColumn('patients', 'first_name', {
                type: Sequelize.STRING(100),
                allowNull: false
            }, { transaction });
            
            // last_name can remain nullable for patients with single names
            
            await transaction.commit();
            console.log('Patient name separation migration completed successfully');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error during patient name migration:', error);
            throw error;
        }
    },
    
    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Reverting patient name separation...');
            
            // Combine first_name and last_name back into name field
            await queryInterface.sequelize.query(`
                UPDATE patients 
                SET name = CASE 
                    WHEN last_name IS NOT NULL AND last_name != '' THEN first_name || ' ' || last_name
                    ELSE first_name
                END
                WHERE first_name IS NOT NULL
            `, { transaction });
            
            // Remove the new columns
            await queryInterface.removeColumn('patients', 'first_name', { transaction });
            await queryInterface.removeColumn('patients', 'last_name', { transaction });
            
            await transaction.commit();
            console.log('Patient name separation rollback completed');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error during rollback:', error);
            throw error;
        }
    }
};
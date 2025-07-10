// Migration: Add optimized search columns for better performance
// File: 023-add-patient-search-optimization.js

module.exports = {
    async up(queryInterface, Sequelize) {
        console.log('Adding optimized search columns to patients table...');
        
        const tableInfo = await queryInterface.describeTable('patients');
        
        // Add first_name_hash column
        if (!tableInfo.first_name_hash) {
            console.log('Adding first_name_hash column...');
            await queryInterface.addColumn('patients', 'first_name_hash', {
                type: Sequelize.STRING(64),
                allowNull: true,
                comment: 'SHA-256 hash of first name for partial search'
            });
        }
        
        // Add last_name_hash column
        if (!tableInfo.last_name_hash) {
            console.log('Adding last_name_hash column...');
            await queryInterface.addColumn('patients', 'last_name_hash', {
                type: Sequelize.STRING(64),
                allowNull: true,
                comment: 'SHA-256 hash of last name for partial search'
            });
        }
        
        // Add name_parts_json column
        if (!tableInfo.name_parts_json) {
            console.log('Adding name_parts_json column...');
            await queryInterface.addColumn('patients', 'name_parts_json', {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'JSON array of hashed name parts for partial matching'
            });
        }
        
        // Add indexes
        try {
            await queryInterface.addIndex('patients', ['first_name_hash'], {
                name: 'idx_patients_first_name_hash'
            });
            console.log('Added first_name_hash index');
        } catch (error) {
            if (error.original?.code !== '42P07') throw error;
            console.log('first_name_hash index already exists');
        }
        
        try {
            await queryInterface.addIndex('patients', ['last_name_hash'], {
                name: 'idx_patients_last_name_hash'
            });
            console.log('Added last_name_hash index');
        } catch (error) {
            if (error.original?.code !== '42P07') throw error;
            console.log('last_name_hash index already exists');
        }
        
        console.log('Optimized search columns added successfully.');
    },

    async down(queryInterface, Sequelize) {
        console.log('Removing optimized search columns...');
        
        // Remove indexes
        try {
            await queryInterface.removeIndex('patients', 'idx_patients_first_name_hash');
            await queryInterface.removeIndex('patients', 'idx_patients_last_name_hash');
        } catch (error) {
            console.log('Some indexes may not exist, continuing...');
        }
        
        // Remove columns
        await queryInterface.removeColumn('patients', 'first_name_hash');
        await queryInterface.removeColumn('patients', 'last_name_hash');
        await queryInterface.removeColumn('patients', 'name_parts_json');
        
        console.log('Optimized search columns removed.');
    }
};
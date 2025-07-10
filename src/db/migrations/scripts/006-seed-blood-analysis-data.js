// db/seeders/001-seed-blood-analysis-data.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Insert default organization settings
        await queryInterface.bulkInsert('organization_settings', [
            {
                setting_key: 'max_analyses_per_day',
                setting_value: '50',
                data_type: 'integer',
                description: 'Maximum number of analyses that can be scheduled per day',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                setting_key: 'working_days',
                setting_value: '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]',
                data_type: 'json',
                description: 'Working days of the week',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                setting_key: 'self_service',
                setting_value: 'true',
                data_type: 'boolean',
                description: 'Choose if users are allowed to edit Their own profiles',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                setting_key: 'auto_archive_enabled',
                setting_value: 'true',
                data_type: 'boolean',
                description: 'Enable automatic archiving of completed analyses older than today',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                setting_key: 'notification_enabled',
                setting_value: 'true',
                data_type: 'boolean',
                description: 'Enable notifications for analysis status changes',
                created_at: new Date(),
                updated_at: new Date()
            },
        ]);

        // Insert some sample doctors
        await queryInterface.bulkInsert('doctors', [
            {
                name: 'Dr. John Smith',
                specialization: 'Hematology',
                phone: '+1234567890',
                email: 'john.smith@hospital.com',
                active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'Dr. Sarah Johnson',
                specialization: 'Internal Medicine',
                phone: '+1234567891',
                email: 'sarah.johnson@hospital.com',
                active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'Dr. Michael Brown',
                specialization: 'Cardiology',
                phone: '+1234567892',
                email: 'michael.brown@hospital.com',
                active: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);

        // Insert some sample rooms
        await queryInterface.bulkInsert('rooms', [
            {
                room_number: '1001',
                service_id: 1,
                capacity: 2,
                active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                room_number: '1002',
                service_id: 1,
                capacity: 2,
                active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                room_number: '2001',
                service_id: 1,
                capacity: 1,
                active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                room_number: '3001',
                service_id: 1,
                capacity: 1,
                active: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        // Remove sample data
        await queryInterface.bulkDelete('rooms', null, {});
        await queryInterface.bulkDelete('doctors', null, {});
        await queryInterface.bulkDelete('organization_settings', null, {});

    }
};
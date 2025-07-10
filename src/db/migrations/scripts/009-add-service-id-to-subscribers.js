// db/migrations/009-add-service-id-to-subscribers.js
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        console.log('🚀 Adding service_id column to mailing_list_subscribers...');
        
        try {
            // Add service_id column
            await queryInterface.addColumn('mailing_list_subscribers', 'service_id', {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'services',
                    key: 'id'
                },
                onDelete: 'CASCADE',
                comment: 'Service subscription (uses service email)'
            });
            console.log('✅ Added service_id column');
            
            // Add unique constraint for service/list combinations
            await queryInterface.addConstraint('mailing_list_subscribers', {
                fields: ['list_id', 'service_id'],
                type: 'unique',
                name: 'unique_service_list_subscription',
                where: {
                    service_id: {
                        [Sequelize.Op.ne]: null
                    }
                }
            });
            console.log('✅ Added unique constraint for service subscriptions');
            
            console.log('🎉 Successfully added service_id column and constraints');
            
        } catch (error) {
            console.error('❌ Error adding service_id column:', error);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        console.log('🔄 Removing service_id column from mailing_list_subscribers...');
        
        try {
            // Remove constraint first
            await queryInterface.removeConstraint('mailing_list_subscribers', 'unique_service_list_subscription');
            console.log('✅ Removed unique constraint');
            
            // Remove column
            await queryInterface.removeColumn('mailing_list_subscribers', 'service_id');
            console.log('✅ Removed service_id column');
            
            console.log('🎉 Successfully removed service_id column and constraints');
            
        } catch (error) {
            console.error('❌ Error removing service_id column:', error);
            throw error;
        }
    }
};
// db/migrations/009-add-service-id-to-subscribers.js
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        console.log('🚀 Adding service_id column to mailing_list_subscribers...');
        
        try {
            // Check if service_id column already exists
            const tableInfo = await queryInterface.describeTable('mailing_list_subscribers');
            
            if (!tableInfo.service_id) {
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
            } else {
                console.log('ℹ️ service_id column already exists, skipping...');
            }
            
            // Check if unique constraint exists
            const constraintExists = await queryInterface.sequelize.query(
                "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'mailing_list_subscribers' AND constraint_name = 'unique_service_list_subscription'",
                { type: Sequelize.QueryTypes.SELECT }
            );
            
            if (constraintExists.length === 0) {
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
            } else {
                console.log('ℹ️ unique constraint already exists, skipping...');
            }
            
            console.log('🎉 Successfully processed service_id column and constraints');
            
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
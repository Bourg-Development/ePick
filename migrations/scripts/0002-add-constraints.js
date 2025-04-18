'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add CHECK constraint for 6-digit username
        await queryInterface.sequelize.query(`
      ALTER TABLE users 
      ADD CONSTRAINT username_6_digits 
      CHECK (username ~ '^[0-9]{6}$')
    `);

        // Add password complexity requirement
        await queryInterface.sequelize.query(`
      ALTER TABLE users 
      ADD CONSTRAINT password_min_length 
      CHECK (length(password_hash) >= 8)
    `);
    },

    down: async (queryInterface) => {
        await queryInterface.sequelize.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS username_6_digits
    `);

        await queryInterface.sequelize.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS password_min_length
    `);
    }
};
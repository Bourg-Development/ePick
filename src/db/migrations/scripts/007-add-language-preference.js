module.exports = {
  async up(queryInterface, Sequelize) {
    // Add preferred_language column to users table
    await queryInterface.addColumn('users', 'preferred_language', {
      type: Sequelize.STRING(2),
      allowNull: true,
      defaultValue: 'en'
    });

    // Add check constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE users 
      ADD CONSTRAINT check_preferred_language 
      CHECK (preferred_language IN ('en', 'fr', 'es'))
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove constraint first
    await queryInterface.sequelize.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS check_preferred_language
    `);

    // Remove column
    await queryInterface.removeColumn('users', 'preferred_language');
  }
};
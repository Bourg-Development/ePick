module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if preferred_language column already exists
    const tableInfo = await queryInterface.describeTable('users');
    
    if (!tableInfo.preferred_language) {
      // Add preferred_language column to users table
      await queryInterface.addColumn('users', 'preferred_language', {
        type: Sequelize.STRING(2),
        allowNull: true,
        defaultValue: 'en'
      });
      console.log('✅ Added preferred_language column');
    } else {
      console.log('ℹ️ preferred_language column already exists, skipping...');
    }

    // Check if constraint exists
    const constraintExists = await queryInterface.sequelize.query(
      "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'users' AND constraint_name = 'check_preferred_language'",
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    if (constraintExists.length === 0) {
      // Add check constraint
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ADD CONSTRAINT check_preferred_language 
        CHECK (preferred_language IN ('en', 'fr', 'es'))
      `);
      console.log('✅ Added check constraint');
    } else {
      console.log('ℹ️ check constraint already exists, skipping...');
    }
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
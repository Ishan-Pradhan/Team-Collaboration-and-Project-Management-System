'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename password -> passwordHash
    // (If column was already renamed manually, this is a no-op via the catch)
    try {
      await queryInterface.renameColumn('Users', 'password', 'passwordHash');
    } catch (err) {
      console.log('renameColumn password->passwordHash skipped:', err.message);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn('Users', 'passwordHash', 'password');
  },
};

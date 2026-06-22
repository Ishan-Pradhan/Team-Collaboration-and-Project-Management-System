'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename isBlocked -> isActive
    await queryInterface.renameColumn('Users', 'isBlocked', 'isActive');

    // Flip the existing values: isBlocked=false => isActive=true, isBlocked=true => isActive=false
    await queryInterface.sequelize.query(`
      UPDATE "Users" SET "isActive" = NOT "isActive"
    `);

    // Update the column default to match the model (defaultValue: true)
    await queryInterface.changeColumn('Users', 'isActive', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Flip values back
    await queryInterface.sequelize.query(`
      UPDATE "Users" SET "isActive" = NOT "isActive"
    `);

    // Rename back to isBlocked
    await queryInterface.renameColumn('Users', 'isActive', 'isBlocked');

    // Restore original default
    await queryInterface.changeColumn('Users', 'isBlocked', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('OrganizationMembers');
    if (!tableInfo.joinedAt) {
      await queryInterface.addColumn('OrganizationMembers', 'joinedAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('OrganizationMembers');
    if (tableInfo.joinedAt) {
      await queryInterface.removeColumn('OrganizationMembers', 'joinedAt');
    }
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('OrganizationMembers', 'isMuted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('OrganizationMembers', 'isMuted');
  },
};

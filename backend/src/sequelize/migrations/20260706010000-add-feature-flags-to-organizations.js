'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Organizations', 'featureFlags', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: { chatEnabled: true, calendarEnabled: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Organizations', 'featureFlags');
  },
};

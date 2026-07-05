'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('channel_members', 'isMuted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('channel_members', 'isMuted');
  },
};

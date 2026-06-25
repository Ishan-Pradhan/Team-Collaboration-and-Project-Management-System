'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if slug already exists to prevent duplicate add errors
    const tableInfo = await queryInterface.describeTable('Organizations');
    if (!tableInfo.slug) {
      await queryInterface.addColumn('Organizations', 'slug', {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      });
    }

    if (!tableInfo.description) {
      await queryInterface.addColumn('Organizations', 'description', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!tableInfo.logoUrl) {
      await queryInterface.addColumn('Organizations', 'logoUrl', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Organizations');
    if (tableInfo.logoUrl) {
      await queryInterface.removeColumn('Organizations', 'logoUrl');
    }
    if (tableInfo.description) {
      await queryInterface.removeColumn('Organizations', 'description');
    }
    if (tableInfo.slug) {
      await queryInterface.removeColumn('Organizations', 'slug');
    }
  }
};

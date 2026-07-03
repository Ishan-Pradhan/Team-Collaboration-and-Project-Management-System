'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('notifications', 'organizationId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Organizations', key: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.addColumn('notifications', 'projectId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'projects', key: 'id' },
      onDelete: 'CASCADE',
    });

    // Backfill: the only notification type written before this migration
    // ('member_left') already stores the organization id as entityId
    // (entityType = 'organization').
    await queryInterface.sequelize.query(`
      UPDATE notifications
      SET "organizationId" = "entityId"
      WHERE "entityType" = 'organization' AND "organizationId" IS NULL
    `);

    await queryInterface.changeColumn('notifications', 'organizationId', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    await queryInterface.addIndex('notifications', ['userId', 'isRead']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('notifications', ['userId', 'isRead']);
    await queryInterface.removeColumn('notifications', 'projectId');
    await queryInterface.removeColumn('notifications', 'organizationId');
  },
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('activity_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      projectId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      actorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      entityType: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      entityId: {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('activity_logs', ['projectId']);
    await queryInterface.addIndex('activity_logs', ['actorId']);
    await queryInterface.addIndex('activity_logs', ['projectId', 'createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('activity_logs');
  },
};

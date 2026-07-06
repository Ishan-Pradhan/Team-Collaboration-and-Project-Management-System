'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_action_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      actorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      action: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      targetType: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      targetId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('admin_action_logs', ['targetType', 'targetId']);
    await queryInterface.addIndex('admin_action_logs', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_action_logs');
  },
};

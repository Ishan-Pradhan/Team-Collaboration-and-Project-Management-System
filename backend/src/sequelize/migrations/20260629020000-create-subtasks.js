'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subtasks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      taskId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tasks', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      isCompleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      position: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      createdById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('subtasks', ['taskId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('subtasks');
  },
};

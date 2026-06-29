'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('task_attachments', {
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
      projectId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      uploadedById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      fileName: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      fileUrl: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      cloudinaryPublicId: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      fileType: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      fileSize: {
        type: Sequelize.INTEGER,
        allowNull: false,
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

    await queryInterface.addIndex('task_attachments', ['taskId']);
    await queryInterface.addIndex('task_attachments', ['projectId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('task_attachments');
  },
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages', 'replyToId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'messages', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('messages', ['replyToId']);

    await queryInterface.addColumn('task_comments', 'replyToId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'task_comments', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('task_comments', ['replyToId']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('task_comments', 'replyToId');
    await queryInterface.removeColumn('messages', 'replyToId');
  },
};

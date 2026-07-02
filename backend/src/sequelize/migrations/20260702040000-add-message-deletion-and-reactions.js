'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'deletedBy', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.createTable('message_reactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      messageId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'messages', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      emoji: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('message_reactions', ['messageId']);
    await queryInterface.addIndex('message_reactions', ['messageId', 'userId', 'emoji'], {
      unique: true,
      name: 'message_reactions_message_id_user_id_emoji_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('message_reactions');
    await queryInterface.removeColumn('messages', 'deletedBy');
    await queryInterface.removeColumn('messages', 'deletedAt');
  },
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('channels', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Organizations', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('PUBLIC', 'PRIVATE'),
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('channels', ['organizationId']);
    await queryInterface.addIndex('channels', ['organizationId', 'name'], {
      unique: true,
      name: 'channels_organization_id_name_unique',
    });

    await queryInterface.createTable('channel_members', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      channelId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'channels', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      joinedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('channel_members', ['channelId']);
    await queryInterface.addIndex('channel_members', ['userId']);
    await queryInterface.addIndex('channel_members', ['channelId', 'userId'], {
      unique: true,
      name: 'channel_members_channel_id_user_id_unique',
    });

    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      channelId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'channels', key: 'id' },
        onDelete: 'CASCADE',
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.ENUM('TEXT', 'SYSTEM'),
        allowNull: false,
        defaultValue: 'TEXT',
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('messages', ['channelId', 'createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('messages');
    await queryInterface.dropTable('channel_members');
    await queryInterface.dropTable('channels');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_channels_type"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_messages_type"');
  },
};

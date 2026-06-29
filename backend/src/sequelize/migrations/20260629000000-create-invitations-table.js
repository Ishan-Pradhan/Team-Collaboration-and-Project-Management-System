'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop old OrganizationInvites table — the Invitation model uses tableName: 'invitations'
    try {
      await queryInterface.dropTable('OrganizationInvites');
    } catch (_) {}
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_OrganizationInvites_status"');
    } catch (_) {}

    await queryInterface.createTable('invitations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'),
        defaultValue: 'PENDING',
        allowNull: false,
      },
      invitedById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      expiresAt: {
        type: Sequelize.DATE,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('invitations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_invitations_status"');
  },
};

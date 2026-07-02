'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_messages_type" ADD VALUE IF NOT EXISTS 'FILE'`);

    await queryInterface.addColumn('messages', 'fileName', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'fileUrl', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'cloudinaryPublicId', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'fileType', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'fileSize', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('messages', 'fileSize');
    await queryInterface.removeColumn('messages', 'fileType');
    await queryInterface.removeColumn('messages', 'cloudinaryPublicId');
    await queryInterface.removeColumn('messages', 'fileUrl');
    await queryInterface.removeColumn('messages', 'fileName');

    // Convert any FILE-type rows back to TEXT before recreating the enum without FILE
    await queryInterface.sequelize.query(`UPDATE "messages" SET type = 'TEXT' WHERE type = 'FILE'`);

    await queryInterface.sequelize.query(`ALTER TABLE "messages" ALTER COLUMN type TYPE VARCHAR(255)`);
    await queryInterface.sequelize.query(`ALTER TABLE "messages" ALTER COLUMN type DROP DEFAULT`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_messages_type"`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_messages_type" AS ENUM ('TEXT', 'SYSTEM')`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "messages"
       ALTER COLUMN type TYPE "enum_messages_type" USING type::"enum_messages_type",
       ALTER COLUMN type SET DEFAULT 'TEXT'`
    );
  },
};

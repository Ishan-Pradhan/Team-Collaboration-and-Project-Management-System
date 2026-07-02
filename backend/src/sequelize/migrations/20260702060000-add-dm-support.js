'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_channels_type" ADD VALUE IF NOT EXISTS 'DM'`);

    await queryInterface.changeColumn('channels', 'name', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn('channels', 'dmKey', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX channels_organization_id_dm_key_unique ON "channels" ("organizationId", "dmKey") WHERE "dmKey" IS NOT NULL`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS channels_organization_id_dm_key_unique`);
    await queryInterface.removeColumn('channels', 'dmKey');

    await queryInterface.sequelize.query(`UPDATE "channels" SET type = 'PRIVATE' WHERE type = 'DM'`);
    await queryInterface.sequelize.query(`UPDATE "channels" SET name = 'unnamed-' || id WHERE name IS NULL`);

    await queryInterface.changeColumn('channels', 'name', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });

    await queryInterface.sequelize.query(`ALTER TABLE "channels" ALTER COLUMN type TYPE VARCHAR(255)`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_channels_type"`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_channels_type" AS ENUM ('PUBLIC', 'PRIVATE')`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "channels" ALTER COLUMN type TYPE "enum_channels_type" USING type::"enum_channels_type"`
    );
  },
};

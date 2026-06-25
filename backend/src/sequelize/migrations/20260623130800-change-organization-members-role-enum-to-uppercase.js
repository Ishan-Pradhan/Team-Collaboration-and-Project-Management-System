'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Temporarily change column type to VARCHAR so we can change the enum definition
    await queryInterface.sequelize.query(
      `ALTER TABLE "OrganizationMembers" ALTER COLUMN role TYPE VARCHAR(255)`
    );

    // 2. Drop default value temporarily
    await queryInterface.sequelize.query(
      `ALTER TABLE "OrganizationMembers" ALTER COLUMN role DROP DEFAULT`
    );

    // 3. Drop the old enum type
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_OrganizationMembers_role"`
    );

    // 4. Update lowercase values ('admin', 'member') to uppercase ('ORG_ADMIN', 'MEMBER')
    await queryInterface.sequelize.query(
      `UPDATE "OrganizationMembers" SET role = 'ORG_ADMIN' WHERE role = 'admin'`
    );
    await queryInterface.sequelize.query(
      `UPDATE "OrganizationMembers" SET role = 'MEMBER' WHERE role = 'member' OR role IS NULL`
    );

    // 5. Create new ENUM type with uppercase values
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_OrganizationMembers_role" AS ENUM ('ORG_ADMIN', 'MEMBER')`
    );

    // 6. Alter column back to the new enum and restore default value
    await queryInterface.sequelize.query(
      `ALTER TABLE "OrganizationMembers" 
       ALTER COLUMN role TYPE "enum_OrganizationMembers_role" USING role::"enum_OrganizationMembers_role",
       ALTER COLUMN role SET DEFAULT 'MEMBER'`
    );
  },

  async down(queryInterface, Sequelize) {
    // 1. Temporarily change column to VARCHAR
    await queryInterface.sequelize.query(
      `ALTER TABLE "OrganizationMembers" ALTER COLUMN role TYPE VARCHAR(255)`
    );

    // 2. Drop default value
    await queryInterface.sequelize.query(
      `ALTER TABLE "OrganizationMembers" ALTER COLUMN role DROP DEFAULT`
    );

    // 3. Drop enum type
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_OrganizationMembers_role"`
    );

    // 4. Revert uppercase to lowercase
    await queryInterface.sequelize.query(
      `UPDATE "OrganizationMembers" SET role = 'admin' WHERE role = 'ORG_ADMIN'`
    );
    await queryInterface.sequelize.query(
      `UPDATE "OrganizationMembers" SET role = 'member' WHERE role = 'MEMBER' OR role IS NULL`
    );

    // 5. Recreate old lowercase enum
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_OrganizationMembers_role" AS ENUM ('admin', 'member')`
    );

    // 6. Restore column enum type and default
    await queryInterface.sequelize.query(
      `ALTER TABLE "OrganizationMembers" 
       ALTER COLUMN role TYPE "enum_OrganizationMembers_role" USING role::"enum_OrganizationMembers_role",
       ALTER COLUMN role SET DEFAULT 'member'`
    );
  }
};

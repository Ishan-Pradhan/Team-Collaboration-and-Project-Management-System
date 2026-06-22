'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Alter the role column to VARCHAR/TEXT temporarily so we can update values without enum constraints
    await queryInterface.sequelize.query(
      `ALTER TABLE "Users" ALTER COLUMN role TYPE VARCHAR(255)`
    );

    // 2. Drop the default value temporarily
    await queryInterface.sequelize.query(
      `ALTER TABLE "Users" ALTER COLUMN role DROP DEFAULT`
    );

    // 3. Drop the old enum type if it exists (might be enum_Users_role or enum_Users_role_old if it failed before)
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_Users_role"`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_Users_role_old"`
    );

    // 4. Update the values to uppercase
    await queryInterface.sequelize.query(
      `UPDATE "Users" SET role = 'USER' WHERE role IN ('user', 'admin') OR role IS NULL`
    );
    await queryInterface.sequelize.query(
      `UPDATE "Users" SET role = 'SUPER_ADMIN' WHERE role = 'superadmin'`
    );
    // Also catch any case-mismatches just in case
    await queryInterface.sequelize.query(
      `UPDATE "Users" SET role = 'SUPER_ADMIN' WHERE UPPER(role) = 'SUPERADMIN' OR UPPER(role) = 'SUPER_ADMIN'`
    );
    await queryInterface.sequelize.query(
      `UPDATE "Users" SET role = 'USER' WHERE role NOT IN ('USER', 'SUPER_ADMIN')`
    );

    // 5. Create the new ENUM type
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_Users_role" AS ENUM ('USER', 'SUPER_ADMIN')`
    );

    // 6. Convert the column back to the new ENUM and set default
    await queryInterface.sequelize.query(
      `ALTER TABLE "Users"
         ALTER COLUMN role TYPE "enum_Users_role" USING role::"enum_Users_role",
         ALTER COLUMN role SET DEFAULT 'USER'`
    );
  },

  async down(queryInterface, Sequelize) {
    // 1. Alter role to VARCHAR/TEXT
    await queryInterface.sequelize.query(
      `ALTER TABLE "Users" ALTER COLUMN role TYPE VARCHAR(255)`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "Users" ALTER COLUMN role DROP DEFAULT`
    );

    // 2. Drop the enum type
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_Users_role"`
    );

    // 3. Update values to lowercase
    await queryInterface.sequelize.query(
      `UPDATE "Users" SET role = 'user' WHERE role = 'USER'`
    );
    await queryInterface.sequelize.query(
      `UPDATE "Users" SET role = 'superadmin' WHERE role = 'SUPER_ADMIN'`
    );

    // 4. Create the old ENUM type
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_Users_role" AS ENUM ('user', 'admin', 'superadmin')`
    );

    // 5. Convert back and set default
    await queryInterface.sequelize.query(
      `ALTER TABLE "Users"
         ALTER COLUMN role TYPE "enum_Users_role" USING role::"enum_Users_role",
         ALTER COLUMN role SET DEFAULT 'user'`
    );
  },
};

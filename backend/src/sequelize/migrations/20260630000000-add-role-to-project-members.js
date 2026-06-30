'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('project_members', 'role', {
      type: Sequelize.ENUM('PROJECT_MANAGER', 'MEMBER'),
      allowNull: false,
      defaultValue: 'MEMBER',
    });

    // Promote existing project creators to PROJECT_MANAGER
    await queryInterface.sequelize.query(`
      UPDATE project_members pm
      SET role = 'PROJECT_MANAGER'
      FROM projects p
      WHERE pm."projectId" = p.id
        AND pm."userId" = p."createdById"
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('project_members', 'role');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_project_members_role";');
  },
};

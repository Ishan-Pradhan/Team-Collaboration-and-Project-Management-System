'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create junction table
    await queryInterface.createTable('task_assignees', {
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
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('task_assignees', ['taskId']);
    await queryInterface.addIndex('task_assignees', ['taskId', 'userId'], { unique: true });

    // 2. Migrate existing single assigneeId data into the junction table
    await queryInterface.sequelize.query(`
      INSERT INTO task_assignees (id, "taskId", "userId", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), id, "assigneeId", NOW(), NOW()
      FROM tasks
      WHERE "assigneeId" IS NOT NULL
    `);

    // 3. Drop old single-assignee column
    await queryInterface.removeColumn('tasks', 'assigneeId');
  },

  async down(queryInterface, Sequelize) {
    // Re-add the column
    await queryInterface.addColumn('tasks', 'assigneeId', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
    });

    // Restore first assignee per task
    await queryInterface.sequelize.query(`
      UPDATE tasks t
      SET "assigneeId" = (
        SELECT "userId" FROM task_assignees ta
        WHERE ta."taskId" = t.id
        ORDER BY ta."createdAt" ASC
        LIMIT 1
      )
    `);

    await queryInterface.dropTable('task_assignees');
  },
};

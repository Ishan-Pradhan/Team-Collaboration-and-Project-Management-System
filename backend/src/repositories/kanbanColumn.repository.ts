import { KanbanColumn } from '../models/index.js';
import type {
  KanbanColumnCreationAttributes,
  KanbanColumnInstance,
} from '../types/kanbanColumns.types.js';

export const kanbanColumnRepository = {
  createDefault: async (projectId: string): Promise<KanbanColumnInstance[]> => {
    const defaults = [
      { name: 'To Do', position: 0, color: '#ececec' },       // light gray/info
      { name: 'In Progress', position: 1, color: '#6f8c78' }, // velocity sage
      { name: 'In Review', position: 2, color: '#d4a84f' },   // brand gold
      { name: 'Done', position: 3, color: '#4b7f52' },        // success green
    ];

    const columns: KanbanColumnInstance[] = [];
    for (const col of defaults) {
      const created = await KanbanColumn.create({
        projectId,
        name: col.name,
        position: col.position,
        color: col.color,
      });
      columns.push(created);
    }
    return columns;
  },

  findByProject: async (projectId: string): Promise<KanbanColumnInstance[]> => {
    return await KanbanColumn.findAll({
      where: { projectId },
      order: [['position', 'ASC']],
    });
  },

  create: async (data: KanbanColumnCreationAttributes): Promise<KanbanColumnInstance> => {
    return await KanbanColumn.create(data);
  },

  update: async (
    id: string,
    data: Partial<KanbanColumnCreationAttributes>
  ): Promise<KanbanColumnInstance | null> => {
    const col = await KanbanColumn.findByPk(id);
    if (!col) return null;
    return await col.update(data);
  },

  delete: async (id: string): Promise<number> => {
    return await KanbanColumn.destroy({
      where: { id },
    });
  },

  reorder: async (projectId: string, orderedIds: string[]): Promise<void> => {
    for (let i = 0; i < orderedIds.length; i++) {
      await KanbanColumn.update(
        { position: i },
        { where: { id: orderedIds[i], projectId } }
      );
    }
  },
};

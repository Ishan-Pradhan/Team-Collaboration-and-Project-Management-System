import { PersonalEvent } from '../models/index.js';
import type { PersonalEventCreationAttributes, PersonalEventInstance } from '../types/personalEvents.types.js';

export const personalEventRepository = {
  create: async (data: PersonalEventCreationAttributes): Promise<PersonalEventInstance> => {
    return await PersonalEvent.create(data);
  },

  findMineInOrg: async (userId: string, organizationId: string): Promise<PersonalEventInstance[]> => {
    return await PersonalEvent.findAll({
      where: { userId, organizationId },
      order: [['dueDate', 'ASC']],
    });
  },

  findByIdForUser: async (id: string, userId: string): Promise<PersonalEventInstance | null> => {
    return await PersonalEvent.findOne({ where: { id, userId } });
  },

  delete: async (id: string): Promise<void> => {
    await PersonalEvent.destroy({ where: { id } });
  },
};

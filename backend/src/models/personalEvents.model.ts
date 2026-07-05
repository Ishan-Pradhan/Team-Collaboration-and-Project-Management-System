import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { PersonalEventInstance } from '../types/personalEvents.types.js';

export const PersonalEvent = sequelize.define<PersonalEventInstance>(
  'PersonalEvent',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    dueSoonNotificationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    overdueNotificationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: 'personal_events',
    timestamps: true,
  }
);

import { Model, type Optional } from 'sequelize';

export interface PersonalEvents {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  dueDate: string | Date;
  dueSoonNotificationSent: boolean;
  overdueNotificationSent: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PersonalEventCreationAttributes = Optional<
  PersonalEvents,
  'id' | 'dueSoonNotificationSent' | 'overdueNotificationSent' | 'createdAt' | 'updatedAt'
>;

export interface PersonalEventInstance
  extends Model<PersonalEvents, PersonalEventCreationAttributes>, PersonalEvents {}

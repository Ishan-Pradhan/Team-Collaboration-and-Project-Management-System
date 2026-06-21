import { Model, type Optional } from 'sequelize';
import type { ProjectInstance } from './projects.types.js';

export interface KanbanColumns {
  id: string;
  projectId: string;
  name: string;
  position: number;
  color: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  project?: ProjectInstance;
}

export type KanbanColumnCreationAttributes = Optional<
  KanbanColumns,
  'id' | 'color' | 'createdAt' | 'updatedAt'
>;

export interface KanbanColumnInstance
  extends Model<KanbanColumns, KanbanColumnCreationAttributes>, KanbanColumns {}

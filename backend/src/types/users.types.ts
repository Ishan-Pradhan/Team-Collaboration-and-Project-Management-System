import { Model, type Optional } from 'sequelize';

export interface Users {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl: string | null;
  role: 'USER' | 'SUPER_ADMIN';
  isVerified: boolean;
  isActive: boolean;
  authProvider: 'local' | 'google' | 'github';
  refreshToken: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  Users,
  | 'id'
  | 'avatarUrl'
  | 'role'
  | 'isVerified'
  | 'isActive'
  | 'authProvider'
  | 'refreshToken'
  | 'createdAt'
  | 'updatedAt'
>;

export interface UserInstance
  extends Model<Users, UserCreationAttributes>, Users { }

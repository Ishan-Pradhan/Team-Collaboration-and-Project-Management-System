

import { Model, type Optional } from 'sequelize';

export interface VerificationAttributes {
    id: string;
    userId: string;
    token: string;
    type: 'emailVerification' | 'passwordReset';
    expiresAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export type VerificationCreationAttributes = Optional<
    VerificationAttributes,
    'id' | 'createdAt' | 'updatedAt'
>;

export type VerificationInstance = Model<
    VerificationAttributes,
    VerificationCreationAttributes
> &
    VerificationAttributes;
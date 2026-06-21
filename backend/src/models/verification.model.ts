
import { DataTypes } from 'sequelize';

import { sequelize } from '../config/db.js';
import type { VerificationInstance } from '../types/verifications.types.js';


export const Verification = sequelize.define<VerificationInstance>(
    'Verification',
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
        token: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        type: {
            type: DataTypes.ENUM('emailVerification', 'passwordReset'),
            allowNull: false,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        tableName: 'Verifications',
        timestamps: true,
    }
);

import { Verification } from '../models/verification.model.js';
import type {
  VerificationCreationAttributes,
  VerificationInstance,
} from '../types/verifications.types.js';

const createToken = async (data: VerificationCreationAttributes) => {
  return await Verification.create(data);
};

export const verificationRepository = {
  createEmailVerification: async (
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<VerificationInstance> => {
    return createToken({
      userId,
      token,
      type: 'emailVerification',
      expiresAt,
    });
  },

  createPasswordResetToken: async (
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<VerificationInstance> => {
    return createToken({
      userId,
      token,
      type: 'passwordReset',
      expiresAt,
    });
  },

  findEmailVerificationByToken: async (
    token: string,
  ): Promise<VerificationInstance | null> => {
    return await Verification.findOne({
      where: {
        token,
        type: 'emailVerification',
      },
    });
  },

  findPasswordResetByToken: async (
    token: string,
  ): Promise<VerificationInstance | null> => {
    return await Verification.findOne({
      where: {
        token,
        type: 'passwordReset',
      },
    });
  },

  deleteById: async (id: string): Promise<number> => {
    return await Verification.destroy({
      where: {
        id,
      },
    });
  },

  deleteEmailVerificationsForUser: async (userId: string): Promise<number> => {
    return await Verification.destroy({
      where: {
        userId,
        type: 'emailVerification',
      },
    });
  },

  deletePasswordResetTokensForUser: async (userId: string): Promise<number> => {
    return await Verification.destroy({
      where: {
        userId,
        type: 'passwordReset',
      },
    });
  },
};

import type { SignOptions } from 'jsonwebtoken';
import { userRepository } from '../repositories/users.repository.js';
import { ApiError } from './ApiError.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Helper function to generate access and refresh tokens
export const generateAccessAndRefereshTokens = async (userId: string) => {
  try {
    const user = await userRepository.findByIdWithSecrets(userId);
    if (!user) throw new ApiError(404, 'User not found');

    const accessTokenSecret = env.ACCESS_TOKEN_SECRET;
    if (!accessTokenSecret)
      throw new ApiError(500, 'ACCESS_TOKEN_SECRET is not set');

    const refreshTokenSecret = env.REFRESH_TOKEN_SECRET;
    if (!refreshTokenSecret)
      throw new ApiError(500, 'REFRESH_TOKEN_SECRET is not set');

    const accessTokenExpiresIn = (env.ACCESS_TOKEN_EXPIRES_IN ||
      '15s') as SignOptions['expiresIn'];
    const refreshTokenExpiresIn = (env.REFRESH_TOKEN_EXPIRES_IN ||
      '7d') as SignOptions['expiresIn'];

    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      accessTokenSecret,
      { ...(accessTokenExpiresIn !== undefined && { expiresIn: accessTokenExpiresIn } as SignOptions), }
    );

    const refreshToken = jwt.sign({ id: user.id }, refreshTokenSecret, {
      ...(refreshTokenExpiresIn !== undefined && { expiresIn: refreshTokenExpiresIn } as SignOptions),
    });

    user.refreshToken = refreshToken;
    await user.save();

    return { accessToken, refreshToken };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while generating tokens';
    throw new ApiError(500, message);
  }
};

import type { Response } from 'express';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from '../config/cookie.config.js';

type AuthResponseParams = {
  res: Response;
  accessToken: string;
  refreshToken: string;
  redirectUrl?: string;
  message?: string;
};

export const sendAuthResponse = ({
  res,
  accessToken,
  refreshToken,
  redirectUrl,
  message = 'Success',
}: AuthResponseParams): void => {
  res
    .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
    .cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

  if (redirectUrl) {
    res.redirect(redirectUrl);
    return;
  }

  res.status(200).json({
    success: true,
    message,
  });
};

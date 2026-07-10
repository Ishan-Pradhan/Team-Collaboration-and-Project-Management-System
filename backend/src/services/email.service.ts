import { Resend } from 'resend';
import { env } from '../config/env.js';

// Escapes user-controlled strings (task titles, org names, etc.) before they're
// interpolated into HTML email templates, preventing HTML/link injection in
// transactional emails sent from the platform's own domain.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Initialize Resend
const getResendClient = () => {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY');
  }
  return new Resend(apiKey);
};

// Pure link builders — shared by controllers (which return the link in the
// API response immediately) and the email worker (which sends the email
// asynchronously). Keeping these separate from the send functions is what
// lets link generation stay synchronous once sending moves to a queue.
export const buildVerifyLink = (token: string): string => {
  const backendUrl = (env.BACKEND_URL || `http://localhost:${env.PORT}`).replace(/\/$/, '');

  return `${backendUrl}/api/v1/auth/verify-email?token=${token}`;
};

export const buildResetLink = (token: string): string => {
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
};

export const buildInviteLink = (token: string): string => {
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl.replace(/\/$/, '')}/accept-invite?token=${token}`;
};

// Send email verification link
export const sendVerificationEmail = async (to: string, token: string) => {
  const verifyLink = buildVerifyLink(token);
  const from = env.EMAIL_FROM;
  const resend = getResendClient();

  await resend.emails.send({
    from,
    to,
    subject: 'Verify your email',
    html: verifyEmailTemplate(verifyLink),
  });
};

// send password reset email
export const sendPasswordResetEmail = async (to: string, token: string) => {
  const resetLink = buildResetLink(token);
  const from = env.EMAIL_FROM;
  const resend = getResendClient();

  await resend.emails.send({
    from,
    to,
    subject: 'Reset your password',
    html: resetPasswordTemplate(resetLink),
  });
};

// Send a generic notification email (channel/project/task events)
export const sendNotificationEmail = async (
  to: string,
  subject: string,
  bodyText: string,
  link: string,
) => {
  const from = env.EMAIL_FROM;
  const resend = getResendClient();

  await resend.emails.send({
    from,
    to,
    subject,
    html: notificationTemplate(subject, bodyText, link),
  });
};

// Send organization invitation email
export const sendOrganizationInviteEmail = async (
  to: string,
  orgName: string,
  token: string,
  invitedByName: string
) => {
  const inviteLink = buildInviteLink(token);
  const from = env.EMAIL_FROM;
  const resend = getResendClient();

  await resend.emails.send({
    from,
    to,
    subject: `Invitation to join ${orgName} on Team Collaboration Platform`,
    html: orgInviteTemplate(orgName, inviteLink, invitedByName),
  });
};

const verifyEmailTemplate = (verifyLink: string) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #2aaad5;">Verify your email</h2>
      
      <p>Welcome! You're almost ready to start using the platform.</p>
      
      <p>Please confirm your email address by clicking the button below:</p>
      
      <a href="${verifyLink}" 
         style="
           display: inline-block;
           padding: 12px 20px;
           margin: 16px 0;
           background-color: #2aaad5;
           color: #ffffff;
           text-decoration: none;
           border-radius: 6px;
           font-weight: bold;
         ">
         Verify Email
      </a>

      <p>If the button doesn't work, you can also use this link:</p>
      <p><a href="${verifyLink}">verify</a></p>

      <hr style="margin: 24px 0;" />

      <p style="font-size: 12px; color: #777;">
        If you didn’t create an account, you can safely ignore this email.
      </p>
    </div>
  `;

const resetPasswordTemplate = (resetLink: string) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      
      <h2 style="color: #e53935;">Reset your password</h2>
      
      <p>We received a request to reset your password.</p>
      
      <p>If you made this request, click the button below to set a new password:</p>

      <a href="${resetLink}"
        style="
          display: inline-block;
          padding: 12px 20px;
          margin: 16px 0;
          background-color: #e53935;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        ">
        Reset Password
      </a>

      <p>If the button doesn’t work, you can also use this link:</p>
      <p><a href="${resetLink}">Reset your password</a></p>

      <hr style="margin: 24px 0;" />

      <p style="font-size: 12px; color: #777;">
        If you didn’t request this, you can safely ignore this email. Your password will remain unchanged.
      </p>

      <p style="font-size: 12px; color: #777;">
        For security, this link will expire after a limited time.
      </p>
    </div>
  `;

const notificationTemplate = (subject: string, bodyText: string, link: string) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #2aaad5;">${escapeHtml(subject)}</h2>

      <p>${escapeHtml(bodyText)}</p>

      <a href="${link}"
         style="
           display: inline-block;
           padding: 12px 20px;
           margin: 16px 0;
           background-color: #2aaad5;
           color: #ffffff;
           text-decoration: none;
           border-radius: 6px;
           font-weight: bold;
         ">
         View in app
      </a>

      <p>If the button doesn't work, you can also use this link:</p>
      <p><a href="${link}">${link}</a></p>
    </div>
  `;

const orgInviteTemplate = (orgName: string, inviteLink: string, invitedByName: string) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #4CAF50;">You've been invited!</h2>
      
      <p>Hi there,</p>
      <p><strong>${escapeHtml(invitedByName)}</strong> has invited you to join the organization <strong>${escapeHtml(orgName)}</strong> on the Team Collaboration Platform.</p>
      
      <p>To accept this invitation and join the organization, click the button below:</p>
      
      <a href="${inviteLink}" 
         style="
           display: inline-block;
           padding: 12px 20px;
           margin: 16px 0;
           background-color: #4CAF50;
           color: #ffffff;
           text-decoration: none;
           border-radius: 6px;
           font-weight: bold;
         ">
         Join Organization
      </a>

      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${inviteLink}">${inviteLink}</a></p>

      <hr style="margin: 24px 0;" />

      <p style="font-size: 12px; color: #777;">
        This invitation link will expire in 24 hours. If you were not expecting this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

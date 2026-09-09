import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../models/User';
import { Organization } from '../models/Organization';
import { env } from '../config/env';
import { DEFAULT_ORGANIZATION_ID } from '../config/database';
import { JWTPayload } from '../types';
import { AppError } from '../middleware/errorHandler';

const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface OtpLoginResult {
  user: IUser;
  tokens: AuthTokens;
  isNewUser: boolean;
}

function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export const authService = {
  async register(input: RegisterInput): Promise<{ user: IUser; tokens: AuthTokens }> {
    const email = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();

    if (!firstName || !lastName || !email || !input.password) {
      throw new AppError('All fields are required', 400, 'VALIDATION_ERROR');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Please enter a valid email address', 400, 'INVALID_EMAIL');
    }
    if (!GMAIL_REGEX.test(email)) {
      throw new AppError('Please use a valid Gmail address ending with @gmail.com.', 400, 'INVALID_EMAIL');
    }
    if (input.password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('This email is already registered.', 409, 'EMAIL_EXISTS');
    }

    const org = await Organization.findById(input.organizationId || DEFAULT_ORGANIZATION_ID);
    if (!org || org.status !== 'active') {
      throw new AppError('Registration organization not found or inactive', 404, 'ORGANIZATION_NOT_FOUND');
    }

    let user: IUser;
    try {
      user = await User.create({
        email,
        password: input.password,
        firstName,
        lastName,
        organizationId: org._id,
        roles: ['employee'],
        isEmailVerified: true,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new AppError('This email is already registered.', 409, 'EMAIL_EXISTS');
      }
      throw err;
    }

    const payload: JWTPayload = {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      roles: user.roles,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: refreshToken } });

    return { user, tokens: { accessToken, refreshToken } };
  },

  async login(input: LoginInput): Promise<{ user: IUser; tokens: AuthTokens }> {
    const email = input.email.trim().toLowerCase();

    const user = await User.findOne({ email }).select('+password +refreshTokens');

    if (!user || user.status !== 'active') {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const payload: JWTPayload = {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      roles: user.roles,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
      lastLoginAt: new Date(),
    });

    return { user, tokens: { accessToken, refreshToken } };
  },

  /**
   * Passwordless Gmail OTP sign-in. Finds or creates the user, then issues the
   * same JWT pair used by the rest of the platform (session + dashboard access).
   * There is NO application-level daily/monthly sign-in limit for users.
   */
  async loginWithOtp(email: string): Promise<OtpLoginResult> {
    const normalized = email.trim().toLowerCase();
    if (!GMAIL_REGEX.test(normalized)) {
      throw new AppError('Please use a valid Gmail address ending with @gmail.com.', 400, 'INVALID_EMAIL');
    }

    let user = await User.findOne({ email: normalized });
    let isNewUser = false;

    if (user) {
      if (user.status !== 'active') {
        throw new AppError('This account is not active. Contact your administrator.', 403, 'ACCOUNT_INACTIVE');
      }
    } else {
      const org = await Organization.findById(DEFAULT_ORGANIZATION_ID);
      if (!org || org.status !== 'active') {
        throw new AppError('Registration organization not found or inactive', 404, 'ORGANIZATION_NOT_FOUND');
      }

      const localPart = normalized.split('@')[0];
      const nameParts = localPart
        .split(/[._+ -]+/)
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
        .filter(Boolean);
      const displayName = nameParts.join(' ') || 'User';
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || firstName;

      try {
        user = await User.create({
          email: normalized,
          // Random, unusable password — OTP is the only credential path for auto-created accounts.
          password: crypto.randomBytes(24).toString('hex'),
          firstName,
          lastName,
          displayName,
          organizationId: org._id,
          roles: ['employee'],
          status: 'active',
          isEmailVerified: true,
        });
        isNewUser = true;
      } catch (err) {
        if ((err as { code?: number }).code === 11000) {
          user = await User.findOne({ email: normalized });
          if (!user) throw new AppError('This email is already registered.', 409, 'EMAIL_EXISTS');
        } else {
          throw err;
        }
      }
    }

    const payload: JWTPayload = {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      roles: user.roles,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
      lastLoginAt: new Date(),
    });

    return { user, tokens: { accessToken, refreshToken }, isNewUser };
  },

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JWTPayload;
    } catch {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_TOKEN');
    }

    const user = await User.findById(decoded.userId).select('+refreshTokens');
    if (!user || user.status !== 'active' || !user.refreshTokens.includes(refreshToken)) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    const payload: JWTPayload = {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      roles: user.roles,
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await User.findByIdAndUpdate(user._id, { $pull: { refreshTokens: refreshToken } });
    await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: newRefreshToken } });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(userId: string, refreshToken: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { $pull: { refreshTokens: refreshToken } });
  },

  async logoutAll(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } });
  },
};
import jwt from 'jsonwebtoken';
import { isAllowedCompanyEmail } from '../utils/emailValidation';
import { User, IUser } from '../models/User';
import { Organization } from '../models/Organization';
import { env } from '../config/env';
import { DEFAULT_ORGANIZATION_ID } from '../config/database';
import { JWTPayload } from '../types';
import { AppError } from '../middleware/errorHandler';

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

function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export const authService = {
  async register(input: RegisterInput): Promise<{ user: IUser; tokens: AuthTokens }> {
    const email = input.email.trim().toLowerCase();

    if (!isAllowedCompanyEmail(email)) {
      throw new AppError('Only company.com email addresses are allowed.', 403, 'FORBIDDEN');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
    }

    // Fall back to the default organization (guaranteed to exist after boot)
    const org = await Organization.findById(input.organizationId || DEFAULT_ORGANIZATION_ID);
    if (!org || org.status !== 'active') {
      throw new AppError('Registration organization not found or inactive', 404, 'ORGANIZATION_NOT_FOUND');
    }

    let user: IUser;
    try {
      user = await User.create({
        email,
        password: input.password,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        organizationId: org._id,
        roles: ['employee'],
      });
    } catch (err) {
      // Handle the race where two registrations for the same email pass the pre-check
      if ((err as { code?: number }).code === 11000) {
        throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
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

    if (!isAllowedCompanyEmail(email)) {
      throw new AppError('Only company.com email addresses are allowed.', 403, 'FORBIDDEN');
    }

    const user = await User.findOne({ email })
      .select('+password +refreshTokens');

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

    // Rotate refresh token (must be two separate updates: Mongo rejects
    // $pull and $push on the same array path in a single update)
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

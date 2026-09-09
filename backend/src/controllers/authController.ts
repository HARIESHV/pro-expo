import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { requestOtp, verifyOtp } from '../services/otpService';
import { isSmtpConfigured } from '../services/emailService';
import { ApiResponse } from '../types';

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    // Roles are never accepted from the client; new users always get the default role.
    const { email, password, firstName, lastName, organizationId } = req.body;
    const { user, tokens } = await authService.register({ email, password, firstName, lastName, organizationId });
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, tokens },
    } as ApiResponse);
  },

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const { user, tokens } = await authService.login({ email, password });
    res.json({ success: true, message: 'Login successful', data: { user, tokens } } as ApiResponse);
  },

  async sendOtp(req: Request, res: Response): Promise<void> {
    const { email } = req.body;
    if (!isSmtpConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Email service is not configured yet. Please set the SMTP credentials in the backend environment.',
        code: 'OTP_NOT_CONFIGURED',
      } as ApiResponse);
      return;
    }
    await requestOtp(email);
    res.json({
      success: true,
      message: 'OTP sent successfully. Check your Gmail inbox.',
      data: { email },
    } as ApiResponse);
  },

  async verifyOtp(req: Request, res: Response): Promise<void> {
    const { email, otp } = req.body;
    await verifyOtp(email, otp);
    const { user, tokens, isNewUser } = await authService.loginWithOtp(email);
    res.status(200).json({
      success: true,
      message: 'Sign in successful',
      data: { user, tokens, isNewUser },
    } as ApiResponse);
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshTokens(refreshToken);
    res.json({ success: true, data: { tokens } } as ApiResponse);
  },

  async logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    if (req.user) await authService.logout(req.user._id.toString(), refreshToken);
    res.json({ success: true, message: 'Logged out successfully' } as ApiResponse);
  },

  async me(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: { user: req.user } } as ApiResponse);
  },
};
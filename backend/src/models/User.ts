import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '../types';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
  roles: UserRole[];
  organizationId: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  managerId?: mongoose.Types.ObjectId;
  status: 'active' | 'inactive' | 'suspended';
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  refreshTokens: string[];
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName: string;
  permissions: string[];
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true },
    avatar: String,
    roles: {
      type: [String],
      enum: ['super_admin', 'admin', 'ceo', 'manager', 'employee', 'analyst', 'hr', 'finance', 'sales'],
      default: ['employee'],
    },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    managerId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    isEmailVerified: { type: Boolean, default: false },
    lastLoginAt: Date,
    refreshTokens: { type: [String], select: false, default: [] },
    preferences: {
      theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
      notifications: { type: Boolean, default: true },
      language: { type: String, default: 'en' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

import { ROLE_PERMISSIONS } from '../config/permissions';

// Virtual: fullName
userSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual: permissions
userSchema.virtual('permissions').get(function (this: IUser) {
  const perms = new Set<string>();
  if (this.roles && Array.isArray(this.roles)) {
    this.roles.forEach((role) => {
      const normalizedRole = role.toLowerCase().trim() as UserRole;
      const rolePerms = ROLE_PERMISSIONS[normalizedRole] || [];
      rolePerms.forEach((p) => perms.add(p));
    });
  }
  return Array.from(perms);
});

// Pre-save: hash password (unless unchanged) and set displayName.
userSchema.pre('save', async function (this: IUser, next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  if (!this.displayName) {
    this.displayName = `${this.firstName} ${this.lastName}`;
  }
  next();
});

// Method: compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON and ensure permissions virtual is always present
userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete (ret as any).password;
    delete (ret as any).refreshTokens;
    // Ensure permissions is always explicitly included from the virtual
    const perms = new Set<string>();
    if (ret.roles && Array.isArray(ret.roles)) {
      for (const role of ret.roles) {
        const normalizedRole = (role as string).toLowerCase().trim() as UserRole;
        const rolePerms = ROLE_PERMISSIONS[normalizedRole] || [];
        for (const p of rolePerms) perms.add(p);
      }
    }
    ret.permissions = Array.from(perms);
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);

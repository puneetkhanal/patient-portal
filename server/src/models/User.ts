// models/User.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// Define User Roles
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  DATA_ENTRY = 'data_entry',
  MEDICAL_REVIEWER = 'medical_reviewer',
  ANALYST = 'analyst'
}

// Permission Types
export enum Permission {
  // Patient Records
  CREATE_PATIENT = 'create_patient',
  READ_PATIENT = 'read_patient',
  UPDATE_PATIENT = 'update_patient',
  DELETE_PATIENT = 'delete_patient',
  
  // Documents
  UPLOAD_DOCUMENTS = 'upload_documents',
  VIEW_DOCUMENTS = 'view_documents',
  VERIFY_DOCUMENTS = 'verify_documents',
  
  // Users
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  
  // Reports
  VIEW_REPORTS = 'view_reports',
  EXPORT_DATA = 'export_data',
  
  // System
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_SETTINGS = 'manage_settings'
}

// Role-Permission Mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    Permission.CREATE_PATIENT,
    Permission.READ_PATIENT,
    Permission.UPDATE_PATIENT,
    Permission.DELETE_PATIENT,
    Permission.UPLOAD_DOCUMENTS,
    Permission.VIEW_DOCUMENTS,
    Permission.VERIFY_DOCUMENTS,
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_SETTINGS
  ],
  
  [UserRole.DATA_ENTRY]: [
    Permission.CREATE_PATIENT,
    Permission.READ_PATIENT,
    Permission.UPDATE_PATIENT,
    Permission.UPLOAD_DOCUMENTS,
    Permission.VIEW_DOCUMENTS
  ],
  
  [UserRole.MEDICAL_REVIEWER]: [
    Permission.READ_PATIENT,
    Permission.VIEW_DOCUMENTS,
    Permission.VERIFY_DOCUMENTS,
    Permission.VIEW_REPORTS
  ],
  
  [UserRole.ANALYST]: [
    Permission.READ_PATIENT, // Anonymized data only
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA
  ]
};

// User Interface
export interface IUser extends Document {
  email: string;
  name: string;
  password_hash: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin?: Date;
  created_at: Date;
  updated_at: Date;
  
  // Methods
  comparePassword(password: string): Promise<boolean>;
  hasPermission(permission: Permission): boolean;
  canViewPatientDetails(): boolean;
  canViewPersonalData(): boolean;
  canViewDocuments(): boolean;
}

export interface IUserModel extends Model<IUser> {
  getPermissionsByRole(role: UserRole): Permission[];
  createSuperAdmin(email: string, name: string, password: string): Promise<IUser>;
}

// User Schema
const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password_hash: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.DATA_ENTRY,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password_hash')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-update middleware
userSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated_at: new Date() });
  next();
});

// Instance Methods
userSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password_hash);
};

userSchema.methods.hasPermission = function(permission: Permission): boolean {
  return ROLE_PERMISSIONS[this.role as UserRole]?.includes(permission) || false;
};

userSchema.methods.canViewPatientDetails = function(): boolean {
  return this.hasPermission(Permission.READ_PATIENT);
};

userSchema.methods.canViewPersonalData = function(): boolean {
  // Analyst can only see anonymized data
  if (this.role === UserRole.ANALYST) return false;
  return this.hasPermission(Permission.READ_PATIENT);
};

userSchema.methods.canViewDocuments = function(): boolean {
  return this.hasPermission(Permission.VIEW_DOCUMENTS);
};

// Static Methods
userSchema.statics.getPermissionsByRole = function(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
};

userSchema.statics.createSuperAdmin = async function(
  email: string,
  name: string,
  password: string
): Promise<IUser> {
  return this.create({
    email,
    name,
    password_hash: password,
    role: UserRole.SUPER_ADMIN,
    isActive: true
  });
};

// Indexes
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ created_at: -1 });

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);

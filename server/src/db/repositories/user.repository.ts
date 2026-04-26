import { User as UserModel, IUser } from '../../models/User.js';
import { CreateUserDTO, UserPublic } from '../types.js';

export class UserRepository {
  async findAll(): Promise<IUser[]> {
    return UserModel.find().sort({ _id: 1 });
  }

  async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() });
  }

  /**
   * Find user by email with password hash (for authentication)
   */
  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() });
  }

  async create(data: CreateUserDTO): Promise<IUser> {
    if (!data.password) {
      throw new Error('Password is required for user creation');
    }

    const user = new UserModel({
      email: data.email.toLowerCase(),
      name: data.name,
      password_hash: data.password, // Will be hashed by pre-save middleware
    });

    return user.save();
  }

  /**
   * Get public user info (without password)
   */
  toPublic(user: IUser): UserPublic {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    };
  }

  async update(id: string, data: Partial<CreateUserDTO>): Promise<IUser | null> {
    const updateData: any = {};

    if (data.email !== undefined) {
      updateData.email = data.email.toLowerCase();
    }
    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    return UserModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await UserModel.findByIdAndDelete(id);
    return result !== null;
  }
}


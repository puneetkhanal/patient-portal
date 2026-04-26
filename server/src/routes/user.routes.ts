import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { User, UserRole } from '../models/User.js';

const router = Router();

router.use(authenticate);

// List all users (super admin only)
router.get('/', authorize(UserRole.SUPER_ADMIN), async (_req: Request, res: Response) => {
  try {
    const users = await User.find({})
      .select('-password_hash')
      .sort({ created_at: -1 });

    return res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Deactivate a user (super admin only)
router.patch('/:id/deactivate', authorize(UserRole.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return res.status(400).json({ error: 'Cannot deactivate super admin' });
    }

    user.isActive = false;
    await user.save();

    return res.json({
      message: 'User deactivated',
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Create a new user (super admin only)
router.post('/', authorize(UserRole.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const { email, name, role, tempPassword } = req.body;

    if (!email || !name || !role || !tempPassword) {
      return res.status(400).json({ error: 'Email, name, role, and tempPassword are required' });
    }

    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (tempPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const user = await User.create({
      email,
      name,
      password_hash: tempPassword,
      role,
      mustChangePassword: true,
      isActive: true
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin,
        mustChangePassword: user.mustChangePassword,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

export default router;

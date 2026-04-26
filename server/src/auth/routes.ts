import { Router, Request, Response } from 'express';
import { verifyPassword, generateToken } from './utils.js';
import { authenticate } from './middleware.js';
import { LoginDTO } from '../db/types.js';
import { User, UserRole } from '../models/User.js';

export function createAuthRoutes(): Router {
  const router = Router();
  // Using Mongoose User model directly

  /**
   * Register a new user
   * POST /api/auth/register
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, name, password } = req.body;

      if (!email || !name || !password) {
        res.status(400).json({ error: 'Email, name, and password are required' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(409).json({ error: 'User with this email already exists' });
        return;
      }

      // Create user
      const user = await User.create({
        email,
        name,
        password_hash: password,
        role: UserRole.DATA_ENTRY,
      });

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role || 'USER',
      });

      res.status(201).json({
        token,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastLogin: user.lastLogin,
          mustChangePassword: user.mustChangePassword,
          created_at: user.created_at
        },
      });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  /**
   * Login
   * POST /api/auth/login
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password }: LoginDTO = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const loginEmail = email === 'admin' ? 'admin@example.com' : email;

      // Find user with password hash
      const user = await User.findOne({ email: loginEmail }).select('+password_hash');

      if (!user || !user.password_hash) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ error: 'User account is deactivated' });
        return;
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password_hash);

      if (!isValid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role || 'USER',
      });

      const responseData = {
        token,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastLogin: user.lastLogin,
          mustChangePassword: user.mustChangePassword,
          created_at: user.created_at
        },
      };

      res.json(responseData);
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Failed to login' });
    }
  });

  /**
   * Get current user info
   * GET /api/auth/me
   */
  router.get('/me', authenticate, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastLogin: user.lastLogin,
          mustChangePassword: user.mustChangePassword,
          created_at: user.created_at
        },
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  /**
   * Change password
   * POST /api/auth/change-password
   */
  router.post('/change-password', authenticate, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current password and new password are required' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      const user = await User.findById(req.user.userId).select('+password_hash');
      if (!user || !user.password_hash) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const isValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isValid) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      user.password_hash = newPassword;
      user.mustChangePassword = false;
      await user.save();

      res.json({
        message: 'Password changed successfully',
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
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  return router;
}

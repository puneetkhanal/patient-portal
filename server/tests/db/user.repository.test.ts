import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { UserRepository } from '../../src/db/repositories/user.repository.js';
import {
  connectTestDatabase,
  disconnectTestDatabase,
  clearTestDatabase
} from './setup.js';

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeAll(async () => {
    await connectTestDatabase();
    repository = new UserRepository();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const user = await repository.create({
        email: 'alice@example.com',
        name: 'Alice Smith',
        password: 'hashedpassword123',
      });

      expect(user).toBeDefined();
      expect(user._id).toBeDefined();
      expect(user.email).toBe('alice@example.com');
      expect(user.name).toBe('Alice Smith');
      expect(user.created_at).toBeDefined();
    });

    it('should enforce unique email constraint', async () => {
      await repository.create({
        email: 'unique@example.com',
        name: 'First User',
        password: 'hashedpassword123',
      });

      await expect(
        repository.create({
          email: 'unique@example.com',
          name: 'Second User',
        })
      ).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return empty array when no users exist', async () => {
      const users = await repository.findAll();
      expect(users).toEqual([]);
    });

    it('should return all users', async () => {
      await repository.create({ email: 'user1@test.com', name: 'User 1', password: 'hashedpassword123' });
      await repository.create({ email: 'user2@test.com', name: 'User 2', password: 'hashedpassword123' });

      const users = await repository.findAll();

      expect(users).toHaveLength(2);
      expect(users.map(u => u.email)).toContain('user1@test.com');
      expect(users.map(u => u.email)).toContain('user2@test.com');
    });
  });

  describe('findById', () => {
    it('should return null for non-existent user', async () => {
      const user = await repository.findById('507f1f77bcf86cd799439011'); // Valid ObjectId format but doesn't exist
      expect(user).toBeNull();
    });

    it('should return user by id', async () => {
      const created = await repository.create({
        email: 'findme@example.com',
        name: 'Find Me',
        password: 'hashedpassword123',
      });

      const found = await repository.findById(created._id.toString());

      expect(found).toBeDefined();
      expect(found?._id.toString()).toBe(created._id.toString());
      expect(found?.email).toBe('findme@example.com');
    });
  });

  describe('findByEmail', () => {
    it('should return null for non-existent email', async () => {
      const user = await repository.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should return user by email', async () => {
      await repository.create({
        email: 'search@example.com',
        name: 'Searchable User',
        password: 'hashedpassword123',
      });

      const found = await repository.findByEmail('search@example.com');

      expect(found).toBeDefined();
      expect(found?.email).toBe('search@example.com');
      expect(found?.name).toBe('Searchable User');
    });
  });

  describe('update', () => {
    it('should update user name', async () => {
      const created = await repository.create({
        email: 'update@example.com',
        name: 'Original Name',
        password: 'hashedpassword123',
      });

      const updated = await repository.update(created._id.toString(), {
        name: 'Updated Name',
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.email).toBe('update@example.com');
    });

    it('should update user email', async () => {
      const created = await repository.create({
        email: 'old@example.com',
        name: 'Test User',
        password: 'hashedpassword123',
      });

      const updated = await repository.update(created._id.toString(), {
        email: 'new@example.com',
      });

      expect(updated?.email).toBe('new@example.com');
    });

    it('should return null for non-existent user', async () => {
      const updated = await repository.update('507f1f77bcf86cd799439011', { name: 'New Name' });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing user', async () => {
      const created = await repository.create({
        email: 'delete@example.com',
        name: 'To Delete',
        password: 'hashedpassword123',
      });

      const deleted = await repository.delete(created._id.toString());
      expect(deleted).toBe(true);

      const found = await repository.findById(created._id.toString());
      expect(found).toBeNull();
    });

    it('should return false for non-existent user', async () => {
      const deleted = await repository.delete('507f1f77bcf86cd799439011');
      expect(deleted).toBe(false);
    });
  });
});


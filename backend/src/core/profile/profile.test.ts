import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../db/connect.js';
import { AuthUser } from '../auth/auth-model.js';
import { profileService } from './profile-service.js';
import { updateProfileSchema } from './profile-validator.js';

const testUserId = '507f1f77bcf86cd799439099';
const otherUserId = '507f1f77bcf86cd799439088';

before(async () => {
  await connectDatabase();
  await AuthUser.deleteMany({
    _id: { $in: [new Types.ObjectId(testUserId), new Types.ObjectId(otherUserId)] },
  });

  // Create an existing user with NO gender (mimicking existing users in database)
  await AuthUser.create({
    _id: new Types.ObjectId(testUserId),
    name: 'Aditi Rao',
    email: 'aditi.test@example.com',
    passwordHash: 'dummyhash123',
    role: 'admin',
    status: 'Active',
  });

  // Create another user
  await AuthUser.create({
    _id: new Types.ObjectId(otherUserId),
    name: 'Other User',
    email: 'other.test@example.com',
    passwordHash: 'dummyhash456',
    role: 'employee',
    status: 'Active',
  });
});

after(async () => {
  await AuthUser.deleteMany({
    _id: { $in: [new Types.ObjectId(testUserId), new Types.ObjectId(otherUserId)] },
  });
  await disconnectDatabase();
});

test('getProfile handles existing users without gender gracefully', async () => {
  const profile = await profileService.getProfile(testUserId);
  assert.equal(profile.name, 'Aditi Rao');
  assert.equal(profile.email, 'aditi.test@example.com');
  assert.equal(profile.gender, null, 'Gender should default to null for existing users');
  assert.equal(
    (profile as unknown as Record<string, unknown>).passwordHash,
    undefined,
    'Must not expose passwordHash',
  );
});

test('updateProfile schema validates gender allowed values', () => {
  // Valid gender: Male
  const validMale = updateProfileSchema.parse({ gender: 'Male' });
  assert.equal(validMale.gender, 'Male');

  // Valid gender: Female
  const validFemale = updateProfileSchema.parse({ gender: 'Female' });
  assert.equal(validFemale.gender, 'Female');

  // Invalid gender
  assert.throws(() => {
    updateProfileSchema.parse({ gender: 'Other' });
  });

  // Empty name rejection
  assert.throws(() => {
    updateProfileSchema.parse({ name: '' });
  });
});

test('updateProfile persists name, phone, designation, and gender to database', async () => {
  const updated = await profileService.updateProfile(testUserId, {
    name: 'Aditi Rao Sharma',
    phone: '9876543210',
    designation: 'Lead Administrator',
    gender: 'Female',
  });

  assert.equal(updated.name, 'Aditi Rao Sharma');
  assert.equal(updated.phone, '9876543210');
  assert.equal(updated.designation, 'Lead Administrator');
  assert.equal(updated.gender, 'Female');

  // Verify direct database persistence in MongoDB
  const inDb = await AuthUser.findById(testUserId);
  assert.ok(inDb);
  assert.equal(inDb.name, 'Aditi Rao Sharma');
  assert.equal(inDb.phone, '9876543210');
  assert.equal(inDb.designation, 'Lead Administrator');
  assert.equal(inDb.gender, 'Female');

  // Verify other user was not modified
  const otherUser = await AuthUser.findById(otherUserId);
  assert.ok(otherUser);
  assert.equal(otherUser.name, 'Other User');
  assert.equal(otherUser.gender, null);
});

test('updateProfile allows changing gender to Male and persists', async () => {
  const updated = await profileService.updateProfile(testUserId, {
    gender: 'Male',
  });

  assert.equal(updated.gender, 'Male');

  const inDb = await AuthUser.findById(testUserId);
  assert.ok(inDb);
  assert.equal(inDb.gender, 'Male');
});

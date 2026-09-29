import { Types } from 'mongoose';

import { NotFoundError } from '../errors/index.js';
import { AuthUser } from '../auth/auth-model.js';
import { AuthService, type PublicUser } from '../auth/auth-service.js';
import type { UpdateProfileInput } from './profile-validator.js';

export const profileService = {
  /** Fetch the authenticated user's profile. */
  async getProfile(userId: string): Promise<PublicUser> {
    return AuthService.getUserById(userId);
  },

  /** Update the authenticated user's own profile. */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    const user = await AuthUser.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (input.name !== undefined) {
      user.name = input.name.trim();
    }
    if (input.phone !== undefined) {
      user.phone = input.phone.trim();
    }
    if (input.designation !== undefined) {
      user.designation = input.designation.trim();
    }
    if (input.gender !== undefined) {
      user.gender = input.gender;
    }

    await user.save();

    // If an employee record is linked to this user, synchronize profile fields
    const { Employee } = await import('../../modules/employees/employees.model.js');
    const employee = await Employee.findOne({ userId: user._id, deletedAt: null }).populate(
      'reportingManagerId',
      'fullName designation',
    );

    if (employee) {
      let employeeModified = false;
      if (input.name !== undefined && employee.fullName !== user.name) {
        employee.fullName = user.name;
        employeeModified = true;
      }
      if (input.phone !== undefined && employee.mobile !== user.phone) {
        employee.mobile = user.phone;
        employeeModified = true;
      }
      if (input.designation !== undefined && employee.designation !== user.designation) {
        employee.designation = user.designation;
        employeeModified = true;
      }
      if (employeeModified) {
        await employee.save();
      }
    }

    return AuthService.toPublicUser(user, employee);
  },
};

import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
  phone: z.string().trim().max(20, 'Phone number cannot exceed 20 characters').optional(),
  designation: z.string().trim().max(100, 'Designation cannot exceed 100 characters').optional(),
  gender: z
    .enum(['Male', 'Female'], {
      errorMap: () => ({ message: 'Gender must be either Male or Female' }),
    })
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

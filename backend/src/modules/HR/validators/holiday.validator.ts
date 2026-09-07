import { z } from 'zod';

export const holidaySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  date: z.coerce.date(),
  description: z.string().optional(),
});

export type HolidayInput = z.infer<typeof holidaySchema>;

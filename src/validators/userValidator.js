import { z } from 'zod';

// Indian phone number validation (10 digits, optionally with +91 or 0 prefix)
const phoneNumberRegex = /^(?:\+91|0)?[6-9]\d{9}$/;

// Aadhaar number validation (12 digits)
const aadhaarRegex = /^\d{12}$/;

// PAN number validation (ABCDE1234F format)
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const userRegistrationSchema = z.object({
  name: z
    .string({
      required_error: 'Name is required',
      invalid_type_error: 'Name must be a string',
    })
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),

  phoneNumber: z
    .string({
      required_error: 'Phone number is required',
      invalid_type_error: 'Phone number must be a string',
    })
    .regex(phoneNumberRegex, 'Invalid Indian phone number format'),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must not exceed 128 characters')
    .optional()
    .nullable(),

  aadhaarNumber: z
    .string()
    .regex(aadhaarRegex, 'Aadhaar number must be exactly 12 digits')
    .trim()
    .optional()
    .nullable(),

  panNumber: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        // If empty/null/undefined, it's valid
        if (!val || val === '') return true;
        // Otherwise, check PAN format
        return panRegex.test(val.toUpperCase());
      },
      {
        message: 'PAN number must be in format: ABCDE1234F',
      }
    )
    .transform((val) => val && val.toUpperCase()),
  registrationId: z
    .string()
    .regex(/^\d{10}$/, 'Registration ID must be exactly 10 digits')
    .trim()
    .optional()
    .nullable(),
  package: z
    .preprocess((val) => Number(val), z.number({ required_error: 'Package is required' })),
  
  pin: z
    .string()
    .trim()
    .optional()
    .nullable(),
    
  referralCode: z
    .string()
    .trim()
    .optional()
    .nullable(),
  isVipRegistration: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val === 'true'),
});

// Query parameters validation for GET API
export const getUsersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, 'Page must be a positive number'),

  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val > 0 && val <= 10000, 'Limit must be between 1 and 10000'),

  search: z.string().optional().default(''),

  sortBy: z
    .enum(['name', 'phoneNumber', 'createdAt', 'aadhaarNumber'])
    .optional()
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const validateUserRegistration = (data) => {
  return userRegistrationSchema.safeParse(data);
};

export const validateGetUsersQuery = (query) => {
  return getUsersQuerySchema.safeParse(query);
};

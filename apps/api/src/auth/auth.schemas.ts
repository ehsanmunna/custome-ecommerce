import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/);

export const customerRegistrationSchema = z
  .object({
    phone: phone.optional(),
    email: email.optional(),
    password: z.string().min(1).optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.phone || value.email), {
    message: 'phone or email is required',
  })
  .refine((value) => !value.password || Boolean(value.email), {
    message: 'password requires an email address',
    path: ['password'],
  });

export const passwordLoginSchema = z
  .object({
    email,
    password: z.string().min(1),
  })
  .strict();

export const otpRequestSchema = z
  .object({
    channel: z.enum(['sms', 'email']),
    destination: z
      .string()
      .trim()
      .min(1)
      .transform((value) => value.toLowerCase()),
    purpose: z.enum(['login', 'registration']),
  })
  .superRefine((value, context) => {
    const valid =
      value.channel === 'sms'
        ? /^\+[1-9][0-9]{7,14}$/.test(value.destination)
        : z.string().email().safeParse(value.destination).success;

    if (!valid) {
      context.addIssue({
        code: 'custom',
        path: ['destination'],
        message: 'must match the selected delivery channel',
      });
    }
  })
  .strict();

export const otpVerifySchema = otpRequestSchema.extend({ code: z.string().min(1) }).strict();

export const refreshRequestSchema = z.object({ refreshToken: z.string().min(1) }).strict();

export type CustomerRegistrationInput = z.infer<typeof customerRegistrationSchema>;
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

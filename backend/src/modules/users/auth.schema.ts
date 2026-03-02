import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(255);

const passwordSchema = z
  .string()
  .min(10, "Password minimal 10 karakter")
  .max(72)
  .refine((v) => /[a-z]/.test(v), "Harus ada huruf kecil")
  .refine((v) => /[A-Z]/.test(v), "Harus ada huruf besar")
  .refine((v) => /\d/.test(v), "Harus ada angka")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Harus ada simbol");

const passwordResetTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{64}$/, "Token reset password tidak valid");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
  verificationCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Kode verifikasi harus 6 digit"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
  captchaToken: z.string().trim().min(1, "Captcha wajib diisi.").optional(),
});

export const requestRegisterCodeSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().trim().min(1, "Captcha wajib diisi."),
});

export const requestPasswordResetLinkSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().trim().min(1, "Captcha wajib diisi."),
});

export const resetPasswordByLinkSchema = z.object({
  token: passwordResetTokenSchema,
  newPassword: passwordSchema,
});

export const validatePasswordResetLinkSchema = z.object({
  token: passwordResetTokenSchema,
});

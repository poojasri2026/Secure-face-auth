import { z } from "zod";

// Mirrors backend validate_password_strength (backend remains authoritative).
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "qwerty123",
  "111111", "12345678910", "letmein", "iloveyou", "admin123", "welcome1",
  "abc12345", "changeme", "passw0rd", "qwertyuiop", "1q2w3e4r", "secret123",
]);

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "At most 128 characters")
  .regex(/[a-z]/, "Needs a lowercase letter")
  .regex(/[A-Z]/, "Needs an uppercase letter")
  .regex(/\d/, "Needs a digit")
  .regex(/[^A-Za-z0-9]/, "Needs a special character")
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "This password is too common");

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(1, "Full name is required").max(255),
    email: z.string().email("Enter a valid email"),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  })
  .refine((d) => !d.password.toLowerCase().includes(d.email.split("@")[0].toLowerCase()), {
    message: "Password must not contain your email name",
    path: ["password"],
  });
export type RegisterForm = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: passwordSchema,
    confirm_new_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_new_password, {
    message: "Passwords do not match",
    path: ["confirm_new_password"],
  });
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export const otpSchema = z.object({
  code: z.string().regex(/^\d{4,10}$/, "Enter the numeric code"),
});
export type OtpForm = z.infer<typeof otpSchema>;

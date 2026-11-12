import { z } from "zod";

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(2, "Full name must be at least 2 characters")
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required")
});

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  created_at: z.string()
});

export const AuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
  user: UserProfileResponseSchema
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

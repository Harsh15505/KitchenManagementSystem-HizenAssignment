import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Enter your password').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** GET /api/auth/me and POST /api/auth/login response. The frontend builds its CASL ability from `permissions`. */
export interface MeResponse {
  user: { id: string; email: string; name: string };
  role: { key: string; name: string };
  permissions: string[];
}

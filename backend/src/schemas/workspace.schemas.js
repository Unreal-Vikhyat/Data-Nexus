import { z } from "zod";

export const workspaceIdSchema = z.object({ workspaceId: z.string().uuid() });
export const memberIdSchema = z.object({ workspaceId: z.string().uuid(), memberId: z.string().uuid() });
export const workspaceCreateSchema = z.object({ name: z.string().trim().min(1).max(160) });
export const workspaceUpdateSchema = workspaceCreateSchema;
export const invitationSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "editor", "viewer"]),
});
export const roleUpdateSchema = z.object({ role: z.enum(["admin", "editor", "viewer"]) });
export const acceptInvitationSchema = z.object({ token: z.string().min(30).max(256) });

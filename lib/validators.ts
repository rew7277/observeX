import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  workspaceName: z.string().min(2),
  billingEmail: z.string().email().optional().or(z.literal(""))
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const workspaceProfileSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().max(500).optional().or(z.literal("")),
  billingEmail: z.string().email().optional().or(z.literal("")),
  domain: z.string().optional().or(z.literal("")),
  retentionDays: z.coerce.number().min(7).max(365),
  ingestionMode: z.string().min(2),
  logStorageMode: z.string().min(2),
  s3Bucket: z.string().optional().or(z.literal("")),
  s3Region: z.string().optional().or(z.literal("")),
  s3Prefix: z.string().optional().or(z.literal(""))
});

export const inviteSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["owner", "admin", "developer", "tester", "manager", "viewer"])
});

export const apiSourceSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["s3", "api"]),
  endpointUrl: z.string().optional().or(z.literal("")),
  bucketName: z.string().optional().or(z.literal("")),
  region: z.string().optional().or(z.literal("")),
  prefix: z.string().optional().or(z.literal("")),
  schedule: z.string().optional().or(z.literal("")),
  authType: z.string().optional().or(z.literal(""))
});

export const alertRuleSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(2),
  metric: z.enum(["errorRate", "avgLatency", "warnCount", "criticalSignals"]),
  operator: z.enum([">", ">=", "<", "<="]),
  threshold: z.coerce.number().min(0),
  severity: z.enum(["low", "medium", "high", "critical"])
});

import { z } from "zod";
import { isSafeHttpUrl } from "@/lib/security";

const safeOptionalText = z.string().trim().max(200).optional().or(z.literal(""));

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(10).max(100)
    .regex(/[A-Z]/, "Must include uppercase")
    .regex(/[a-z]/, "Must include lowercase")
    .regex(/[0-9]/, "Must include number"),
  workspaceName: z.string().trim().min(2).max(80),
  billingEmail: z.string().trim().email().optional().or(z.literal(""))
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(10).max(100)
});

export const workspaceProfileSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  billingEmail: z.string().trim().email().optional().or(z.literal("")),
  domain: safeOptionalText,
  retentionDays: z.coerce.number().int().min(7).max(365),
  ingestionMode: z.string().trim().min(2).max(60),
  logStorageMode: z.string().trim().min(2).max(60),
  maxMonthlyIngestMb: z.coerce.number().int().min(128).max(500000).default(512),
  maxUsers: z.coerce.number().int().min(1).max(10000).default(5),
  s3Bucket: safeOptionalText,
  s3Region: safeOptionalText,
  s3Prefix: safeOptionalText
});

export const inviteSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().trim().email(),
  role: z.enum(["owner", "admin", "developer", "tester", "manager", "viewer"])
});

export const apiSourceSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  type: z.enum(["s3", "api"]),
  endpointUrl: z.string().trim().optional().or(z.literal(""))
    .refine((value) => !value || isSafeHttpUrl(value), "Endpoint URL must be a valid HTTP/HTTPS URL"),
  bucketName: safeOptionalText,
  region: safeOptionalText,
  prefix: safeOptionalText,
  schedule: z.string().trim().max(100).optional().or(z.literal("")),
  authType: z.string().trim().max(40).optional().or(z.literal(""))
});

export const alertRuleSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  metric: z.enum(["errorRate", "avgLatency", "warnCount", "criticalSignals", "p95Latency", "piiEvents"]),
  operator: z.enum([">", ">=", "<", "<="]),
  threshold: z.coerce.number().min(0),
  severity: z.enum(["low", "medium", "high", "critical"])
});

import type { MembershipRole } from "@prisma/client";

const PERMISSIONS: Record<MembershipRole, string[]> = {
  owner: ["*"] ,
  admin: ["workspace:update", "member:invite", "source:write", "alert:write", "upload:write", "search:save"],
  manager: ["workspace:update", "alert:write", "upload:write", "search:save"],
  developer: ["source:write", "upload:write", "search:save"],
  tester: ["upload:write", "search:save"],
  viewer: ["search:save"]
};

export function hasPermission(role: MembershipRole, permission: string) {
  const grants = PERMISSIONS[role] || [];
  return grants.includes("*") || grants.includes(permission);
}

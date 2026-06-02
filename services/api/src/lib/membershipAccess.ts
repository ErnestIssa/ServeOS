import type { Role } from "@prisma/client";
import { mapBackendRoleToBucket, type MobileRoleType } from "./mobileExperience.js";

const VENUE_ROLES: Role[] = ["OWNER", "MANAGER", "STAFF", "KITCHEN", "CASHIER"];

export function isVenueMembershipRole(role: string): boolean {
  return VENUE_ROLES.includes(role.trim().toUpperCase() as Role);
}

export function membershipBucket(role: string): MobileRoleType {
  return mapBackendRoleToBucket(role);
}

export function isAdminMembershipRole(role: string): boolean {
  return membershipBucket(role) === "ADMIN";
}

export function isStaffMembershipRole(role: string): boolean {
  return membershipBucket(role) === "STAFF";
}

import type { EventEmitter } from "node:events";

export type StaffRealtimeEvent =
  | { type: "staff.roster.updated"; restaurantId: string }
  | { type: "staff.online"; restaurantId: string; userId: string }
  | { type: "staff.offline"; restaurantId: string; userId: string }
  | { type: "staff.activity.updated"; restaurantId: string; userId: string }
  | { type: "staff.session.revoked"; restaurantId: string; userId: string };

export function publishStaffRealtimeEvent(bus: EventEmitter, event: StaffRealtimeEvent) {
  bus.emit("staff.realtime", event);
}

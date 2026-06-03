import type { EventEmitter } from "node:events";
import { publishDomainEventToUpstash } from "@serveos/core-upstash";
import type { DomainEvent } from "./types.js";

export async function publishDomainEvent(bus: EventEmitter, event: DomainEvent): Promise<void> {
  bus.emit("domain-event", event);
  try {
    await publishDomainEventToUpstash(event);
  } catch {
    /* in-process delivery still runs */
  }
}

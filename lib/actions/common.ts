import { randomUUID } from "crypto";
import { tenantBusinessId } from "@/lib/businesses";

export type WriteActor = {
  id: string;
  role?: string;
  locationId?: string;
  assignedLocations?: string[];
};

export function createReference(prefix: string) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function actorBusinessIds(actor: WriteActor) {
  return [...new Set([
    tenantBusinessId(actor.locationId),
    ...(actor.assignedLocations || []).map((id) => tenantBusinessId(id)),
  ].filter(Boolean))];
}

export function assertLocationAccess(actor: WriteActor, locationId: string, message = "You do not have access to the selected business.") {
  const tenant = tenantBusinessId(locationId);
  const allowed = actor.role === "Super Admin"
    || actorBusinessIds(actor).includes(tenant)
    || actor.locationId === locationId
    || actor.assignedLocations?.includes(locationId);
  if (!allowed) throw new Error(message);
}

export function resolveActorLocationId(actor: WriteActor, requested?: string | null) {
  const locationId = String(requested || actor.locationId || "").trim();
  if (!locationId) throw new Error("Select a business.");
  assertLocationAccess(actor, locationId);
  return tenantBusinessId(locationId) || locationId;
}

export async function assertRecordBelongsToLocation<T extends { id: string; locationId?: string }>(
  record: T | null,
  locationId: string,
  message: string,
) {
  if (!record || record.locationId !== locationId) throw new Error(message);
  return record;
}


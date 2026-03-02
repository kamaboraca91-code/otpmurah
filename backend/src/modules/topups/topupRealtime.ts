import { EventEmitter } from "events";

const bus = new EventEmitter();
bus.setMaxListeners(0);

function channel(userId: string) {
  return `topups:${userId}`;
}

export type TopupRealtimeEvent = {
  type: "created" | "updated" | "credited" | "canceled";
  item: any;
  balance?: number;
};

export function publishTopupEvent(userId: string, event: TopupRealtimeEvent) {
  if (!userId) return;
  bus.emit(channel(userId), event);
}

export function subscribeTopupEvents(
  userId: string,
  listener: (event: TopupRealtimeEvent) => void,
) {
  const key = channel(userId);
  bus.on(key, listener);
  return () => bus.off(key, listener);
}

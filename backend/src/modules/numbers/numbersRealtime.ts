import { EventEmitter } from "events";

const bus = new EventEmitter();
bus.setMaxListeners(0);

function channel(userId: string) {
  return `numbers:${userId}`;
}

export type NumberRealtimeEvent = {
  type: "order_created" | "status_updated" | "order_canceled";
  item: any;
  balance?: number;
};

export function publishNumberEvent(userId: string, event: NumberRealtimeEvent) {
  if (!userId) return;
  bus.emit(channel(userId), event);
}

export function subscribeNumberEvents(
  userId: string,
  listener: (event: NumberRealtimeEvent) => void,
) {
  const key = channel(userId);
  bus.on(key, listener);
  return () => {
    bus.off(key, listener);
  };
}

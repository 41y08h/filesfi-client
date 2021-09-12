import { useEffect } from "react";
import socket from "../RTCs/socket";

export default function useEventSubscription(
  event: string,
  listener: (...args: any[]) => unknown
) {
  useEffect(() => {
    socket.on(event, listener);
    return () => {
      socket.off(event);
    };
  }, [event, listener]);
}

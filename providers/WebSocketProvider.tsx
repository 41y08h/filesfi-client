import React, { createContext, FC, useContext, useState } from "react";
import useEventSubscription from "../hooks/useEventSubscription";
import socket from "../RTCs/socket";

interface WebSocketContextValue {
  id: number | null;
  isSocketConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(
  undefined
);

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("Expected the WebSocketContext to be initialized");
  return ctx;
}

export const WebSocketProvider: FC = ({ children }) => {
  const [id, setId] = useState<number | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Connectivity
  useEventSubscription("connect", () => {
    socket.emit("join");
  });

  useEventSubscription("join/callback", (id: number) => {
    setId(id);
    setIsSocketConnected(true);
  });

  useEventSubscription("disconnect", () => {
    setIsSocketConnected(false);
    setId(null);
  });

  const value: WebSocketContextValue = { id, isSocketConnected };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

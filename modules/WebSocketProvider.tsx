import React, { createContext, FC, useContext, useState } from "react";
import useEventSubscription from "../hooks/useEventSubscription";
import socket from "../RTCs/socket";

interface WebSocketContext {
  id: number | null;
  isSocketConnected: boolean;
}

const WebSocketContext = createContext(undefined);

export function useWebSocket(): WebSocketContext {
  return useContext(WebSocketContext);
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

  const value: WebSocketContext = { id, isSocketConnected };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

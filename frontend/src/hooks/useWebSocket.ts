import React, { useState, useEffect, useCallback } from 'react';

interface WebSocketHookResult {
  isConnected: boolean;
  lastMessage: unknown;
  send: (data: unknown) => void;
}

export function useWebSocket(userId?: string): WebSocketHookResult {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!userId) return;
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws?userId=${userId}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    socket.onerror = () => setIsConnected(false);
    socket.onmessage = (event) => {
      try { setLastMessage(JSON.parse(event.data)); } catch {}
    };

    setWs(socket);
    return () => socket.close();
  }, [userId]);

  const send = useCallback((data: unknown) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, [ws]);

  return { isConnected, lastMessage, send };
}

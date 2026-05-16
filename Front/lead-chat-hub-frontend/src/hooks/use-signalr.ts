import { useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const HUB_URL = `${API_BASE}/hubs/chat`;

let globalConnection: signalR.HubConnection | null = null;

export function useSignalR() {
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    if (globalConnection && globalConnection.state === signalR.HubConnectionState.Connected) {
      connectionRef.current = globalConnection;
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => localStorage.getItem("access_token") || "",
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection
      .start()
      .then(() => {
        console.log("SignalR connected");
        globalConnection = connection;
        connectionRef.current = connection;
      })
      .catch((err) => console.error("SignalR connection error:", err));

    return () => {
      // Don't disconnect on unmount - keep global connection
    };
  }, []);

  const joinEmpresa = useCallback((empresaId: string) => {
    connectionRef.current?.invoke("JoinEmpresa", empresaId);
  }, []);

  const leaveEmpresa = useCallback((empresaId: string) => {
    connectionRef.current?.invoke("LeaveEmpresa", empresaId);
  }, []);

  const joinConversa = useCallback((conversaId: string) => {
    connectionRef.current?.invoke("JoinConversa", conversaId);
  }, []);

  const leaveConversa = useCallback((conversaId: string) => {
    connectionRef.current?.invoke("LeaveConversa", conversaId);
  }, []);

  const on = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      connectionRef.current?.on(event, callback);
      return () => connectionRef.current?.off(event, callback);
    },
    []
  );

  return { connection: connectionRef.current, joinEmpresa, leaveEmpresa, joinConversa, leaveConversa, on };
}

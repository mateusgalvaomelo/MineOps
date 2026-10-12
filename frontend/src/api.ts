import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export async function request<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : "Invalid request. Check the fields and try again.",
    );
  }
  return response.json();
}
export function useData<T>(path: string, enabled = true) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: () => request<T>(path),
    enabled,
    refetchInterval: 10000,
  });
}
export function useLive() {
  const client = useQueryClient();
  const [state, setState] = useState("Connecting");
  useEffect(() => {
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let stopped = false;
    let attempts = 0;
    function connect() {
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`,
      );
      socket.onopen = () => {
        attempts = 0;
        setState("Live");
      };
      socket.onmessage = () => {
        client.invalidateQueries();
      };
      socket.onclose = () => {
        if (!stopped) {
          setState("Reconnecting · polling");
          retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 15000));
        }
      };
      socket.onerror = () => socket.close();
    }
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.close();
    };
  }, [client]);
  return state;
}

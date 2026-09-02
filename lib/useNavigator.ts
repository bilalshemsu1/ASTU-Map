"use client";

export type Stop = {
  poiId?: string;
  coordId?: string;
  label: string;
};

export type RouteStatus = "idle" | "ready" | "unreachable";

export type NavigateState = {
  start: Stop | null;
  end: Stop | null;
  status: RouteStatus;
};

export function useNavigator(): NavigateState {
  return {
    start: null,
    end: null,
    status: "idle",
  };
}
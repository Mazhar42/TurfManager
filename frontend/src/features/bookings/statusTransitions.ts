import type { BookingStatus } from "@/lib/types";

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const STATUS_ACTION_LABEL: Record<BookingStatus, string> = {
  pending: "Mark pending",
  confirmed: "Confirm",
  completed: "Mark completed",
  cancelled: "Cancel booking",
  no_show: "Mark no-show",
};

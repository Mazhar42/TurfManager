import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "booked" | "due" | "paid" | "partial" | "danger" | "brand";
}

const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-surface-raised text-text-muted border-border",
  booked: "bg-[var(--booked-bg)] text-[var(--booked-text)] border-[var(--booked-border)]",
  due: "bg-[var(--due-bg)] text-[var(--due-text)] border-[var(--due-border)]",
  paid: "bg-[var(--paid-bg)] text-[var(--paid-text)] border-[var(--paid-border)]",
  partial: "bg-[var(--partial-bg)] text-[var(--partial-text)] border-[var(--partial-border)]",
  danger: "bg-danger-soft text-danger border-transparent",
  brand: "bg-brand-soft text-brand-strong border-transparent",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-none", toneClasses[tone], className)}
      {...props}
    />
  );
}

const statusLabel: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const statusTone: Record<BookingStatus, BadgeProps["tone"]> = {
  pending: "partial",
  confirmed: "booked",
  completed: "brand",
  cancelled: "neutral",
  no_show: "danger",
};

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <Badge tone={statusTone[status]} className={className}>
      {statusLabel[status]}
    </Badge>
  );
}

const paymentLabel: Record<PaymentStatus, string> = { unpaid: "Unpaid", partial: "Partial", paid: "Paid", refunded: "Refunded" };
const paymentTone: Record<PaymentStatus, BadgeProps["tone"]> = { unpaid: "due", partial: "partial", paid: "paid", refunded: "neutral" };

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <Badge tone={paymentTone[status]} className={className}>
      {paymentLabel[status]}
    </Badge>
  );
}

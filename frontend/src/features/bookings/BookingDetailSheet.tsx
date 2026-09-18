import { Sheet } from "@/components/ui/Sheet";
import { BookingDetailContent } from "@/features/bookings/BookingDetailContent";

export function BookingDetailSheet({
  bookingId,
  onClose,
}: {
  bookingId: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!bookingId} onClose={onClose} title="Booking">
      {bookingId && <BookingDetailContent bookingId={bookingId} />}
    </Sheet>
  );
}

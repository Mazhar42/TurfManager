import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { BookingDetailContent } from "@/features/bookings/BookingDetailContent";

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-lg px-4 py-4 sm:py-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text"
      >
        <ChevronLeft size={16} /> Back
      </button>
      {id && <BookingDetailContent bookingId={id} />}
    </div>
  );
}

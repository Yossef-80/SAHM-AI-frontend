import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <CalendarView />
    </Suspense>
  );
}

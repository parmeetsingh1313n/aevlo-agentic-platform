import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScheduleTab() {
  return (
    <div>
      <h3 className="text-sm font-semibold">Recurring work</h3>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        Prepare a routine once, then run it on a schedule.
      </p>
      <div className="py-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted">
          <CalendarClock
            className="size-7 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </span>
        <h4 className="mt-4 text-sm font-medium">Scheduling comes later</h4>
        <p className="mx-auto mt-2 max-w-60 text-xs leading-5 text-muted-foreground">
          Scheduled routines will be available once agent execution is
          connected.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled
          className="mt-5 min-h-9 text-xs"
          aria-label="Create schedule, coming later"
        >
          Create schedule
        </Button>
      </div>
      <div className="border-t border-border pt-4">
        <p className="text-xs font-medium">Ideas for later</p>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
          <li>A morning email brief</li>
          <li>A weekly project recap</li>
          <li>A daily calendar check-in</li>
        </ul>
      </div>
    </div>
  );
}

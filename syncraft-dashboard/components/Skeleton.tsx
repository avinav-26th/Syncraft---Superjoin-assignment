import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper for cleaner tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/80", className)}
      {...props}
    />
  );
}

// A pre-built "Table Loading" view
export function TableSkeleton() {
  return (
    <div className="w-full space-y-3 p-4">
      {/* Header Mimic */}
      <div className="flex gap-4 border-b border-slate-100 pb-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-24 bg-slate-300/50" />
        ))}
      </div>
      {/* Row Mimics */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex gap-4 py-2">
          <Skeleton className="h-6 w-12" /> {/* ID */}
          <Skeleton className="h-6 w-32" /> {/* Name */}
          <Skeleton className="h-6 w-24" /> {/* City */}
          <Skeleton className="h-6 w-20" /> {/* Age */}
        </div>
      ))}
    </div>
  );
}
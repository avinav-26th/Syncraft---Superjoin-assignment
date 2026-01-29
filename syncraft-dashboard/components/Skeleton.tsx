import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-md bg-slate-200/80", className)} {...props} />
  );
}

export function TableSkeleton() {
  return (
    <div className="w-full h-full p-6 space-y-6 bg-white">
      {/* Header */}
      <div className="flex justify-between border-b pb-4 border-slate-100">
         <div className="flex gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
         </div>
      </div>
      {/* Big Rows */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex gap-4 items-center">
            <Skeleton className="h-10 w-12 rounded" /> {/* ID */}
            <Skeleton className="h-10 flex-1 rounded" /> {/* Content */}
            <Skeleton className="h-10 flex-1 rounded" /> {/* Content */}
            <Skeleton className="h-10 flex-1 rounded" /> {/* Content */}
          </div>
        ))}
      </div>
    </div>
  );
}
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("glass rounded-[28px]", className)}>{children}</div>;
}

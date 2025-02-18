import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";
import { BouncingDots } from "./BouncingDots";

export function AIThinkingIndicator() {
  return (
    <div className={cn("mb-3 flex items-center", "me-5 justify-start")}>
      {<Bot size={20} className="mr-2 shrink-0" />}
      <div className={cn("rounded-md border bg-background px-3 leading-6")}>
        <BouncingDots />
      </div>
    </div>
  );
}

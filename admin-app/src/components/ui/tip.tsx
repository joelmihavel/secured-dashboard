"use client";

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

export function Tip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-current/30">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] bg-[#1a1a1a] text-[11px] text-muted-foreground border border-[#2a2a2a] font-sans font-normal leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

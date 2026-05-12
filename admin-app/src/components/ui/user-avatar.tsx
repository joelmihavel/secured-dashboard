"use client";

import { useMemo } from "react";
import multiavatar from "@multiavatar/multiavatar";

export function UserAvatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const svg = useMemo(() => multiavatar(name || "default"), [name]);

  return (
    <div
      className={className}
      style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentEnvironment } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview" },
  { href: "/users", label: "Users" },
  { href: "/payments", label: "Payments" },
  { href: "/settings", label: "Settings" },
];

const Y = "bg-[#E8A020]";
const S = "bg-[#C07818]";
const K = "bg-[#2D1B00]";
const Pk = "bg-[#FF9090]";
const W = "bg-[#FFF8E0]";
const _ = "bg-transparent";

const CAT_FRAMES = [
  // Frame 0: crouching, paw down
  [
    [_,_,_,_,K,_,K,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,K,Y,K,Y,K,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,K,Y,Y,Y,Y,Y,K,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,K,W,K,Y,K,W,K,_,_,_,_,_,_,_,_,_,K,_],
    [_,_,K,Y,Y,Pk,Y,Y,K,_,_,_,_,_,_,_,_,K,S,K],
    [_,_,_,K,K,Y,K,K,S,K,S,K,S,K,S,K,K,S,K,_],
    [_,_,_,_,K,Y,S,Y,S,Y,S,Y,S,Y,S,Y,S,K,_,_],
    [_,_,_,_,K,Y,Y,Y,Y,Y,Y,Y,Y,Y,Y,Y,K,_,_,_],
    [_,_,_,_,_,K,Y,K,_,_,_,_,_,K,Y,K,_,_,_,_],
    [_,_,_,_,_,K,K,_,_,_,_,_,_,_,K,K,_,_,_,_],
  ],
  // Frame 1: paw reaching forward
  [
    [_,_,_,_,K,_,K,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,K,Y,K,Y,K,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,K,Y,Y,Y,Y,Y,K,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,K,W,K,Y,K,W,K,_,_,_,_,_,_,_,_,_,K,_],
    [_,_,K,Y,Y,Pk,Y,Y,K,_,_,_,_,_,_,_,_,K,S,K],
    [_,_,_,K,K,Y,K,K,S,K,S,K,S,K,S,K,K,S,K,_],
    [_,_,_,_,K,Y,S,Y,S,Y,S,Y,S,Y,S,Y,S,K,_,_],
    [_,_,_,_,K,Y,Y,Y,Y,Y,Y,Y,Y,Y,Y,Y,K,_,_,_],
    [_,_,_,K,Y,K,_,_,_,_,_,_,_,K,Y,K,_,_,_,_],
    [_,_,_,K,K,_,_,_,_,_,_,_,_,_,K,K,_,_,_,_],
  ],
];

function PixelCat() {
  const px = 3;
  return (
    <div className="relative flex-shrink-0" style={{ width: 20 * px + 8, height: 10 * px + 2 }}>
      <style>{`
        @keyframes catPaw { 0%,65%{opacity:1} 66%,100%{opacity:0} }
        @keyframes catPaw2 { 0%,65%{opacity:0} 66%,100%{opacity:1} }
        @keyframes ballRoll {
          0%,100%{transform:translate(1px,22px)}
          30%{transform:translate(6px,16px)}
          60%{transform:translate(11px,22px)}
        }
        .cat-f0 { animation: catPaw 1.4s steps(1) infinite; }
        .cat-f1 { animation: catPaw2 1.4s steps(1) infinite; }
        .cat-ball { animation: ballRoll 1.4s ease-in-out infinite; }
      `}</style>
      <div className="cat-f0 absolute inset-0">
        {CAT_FRAMES[0].map((row, y) => row.map((c, x) =>
          c !== _ ? <div key={`0-${y}-${x}`} className={cn("absolute", c)} style={{ width: px, height: px, left: x * px, top: y * px }} /> : null
        ))}
      </div>
      <div className="cat-f1 absolute inset-0">
        {CAT_FRAMES[1].map((row, y) => row.map((c, x) =>
          c !== _ ? <div key={`1-${y}-${x}`} className={cn("absolute", c)} style={{ width: px, height: px, left: x * px, top: y * px }} /> : null
        ))}
      </div>
      <div className="cat-ball absolute rounded-full bg-[#CC2244]" style={{ width: 5, height: 5 }} />
    </div>
  );
}

export function Header() {
  const env = getCurrentEnvironment();
  const pathname = usePathname();

  return (
    <header className="flex h-[52px] items-center gap-6 border-b border-[#1F1F1F] px-8">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Image src="/flent-logo.svg" alt="Flent" width={22} height={22} className="brightness-90" />
        <span className="text-[15px] font-normal tracking-[-0.3px] text-foreground">
          SECURED
        </span>
      </div>

      {/* Pixel Cat */}
      <PixelCat />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Nav tabs */}
      <nav className="flex items-center gap-px">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-[6px] px-[14px] py-[6px] text-[12px] transition-colors",
                isActive
                  ? "bg-[#FF9A6D] font-medium text-[#0A0A0A]"
                  : "text-[#A3A3A3] hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="h-6 w-px bg-[#1F1F1F]" />

      {/* Env indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "size-[6px] rounded-full",
            env === "dev" ? "bg-warning" : "bg-green-500"
          )}
        />
        <span
          className={cn(
            "font-mono text-[11px] font-medium",
            env === "dev" ? "text-warning" : "text-muted-foreground"
          )}
        >
          {env === "dev" ? "DEV" : "MAIN"}
        </span>
      </div>

      {/* Avatar */}
      <Avatar className="size-8 bg-secondary">
        <AvatarFallback className="bg-secondary text-[11px] text-muted-foreground">
          RA
        </AvatarFallback>
      </Avatar>
    </header>
  );
}

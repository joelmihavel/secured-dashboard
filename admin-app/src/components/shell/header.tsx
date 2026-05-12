"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { openCommandPalette } from "@/components/shell/command-palette";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Search, ChevronDown, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview" },
  { href: "/users", label: "Users" },
  { href: "/payments", label: "Payments" },
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

      {/* Search trigger */}
      <button
        onClick={openCommandPalette}
        className="flex items-center gap-2 rounded-lg border border-[#1F1F1F] bg-[#141414] px-3 py-1.5 text-muted-foreground/30 hover:border-[#2a2a2a] hover:text-muted-foreground/50 transition-colors"
      >
        <Search className="size-3.5" />
        <span className="font-mono text-[11px]">Search</span>
        <kbd className="ml-3 rounded border border-[#1F1F1F] bg-[#0A0A0A] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/20">⌘K</kbd>
      </button>

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

      {/* Profile */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04] transition-colors">
            <UserAvatar name="vidyuth@flent.in" size={28} />
            <span className="font-mono text-[11px] text-muted-foreground">Admin</span>
            <ChevronDown className="size-3 text-muted-foreground/40" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[180px] border-[#1F1F1F] bg-[#141414] p-1.5">
          <div className="px-2.5 py-2 border-b border-[#1F1F1F] mb-1.5">
            <div className="font-mono text-[11px] text-foreground">Admin</div>
            <div className="font-mono text-[10px] text-muted-foreground/40 truncate">vidyuth@flent.in</div>
          </div>
          <button
            onClick={() => { window.location.href = "/login"; }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </PopoverContent>
      </Popover>
    </header>
  );
}

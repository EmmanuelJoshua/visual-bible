"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** the explorer is the experience; the rest are its full-page views */
const links = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore", match: ["/explore", "/journeys"] },
  { href: "/explore?story=dwelling", label: "Story" },
  { href: "/genealogy", label: "Family tree" },
  { href: "/timeline", label: "Timeline" },
  { href: "/artifacts", label: "Builds" },
];

export function SiteNav() {
  const pathname = usePathname();
  const linksRef = useRef<HTMLDivElement>(null);

  // on narrow screens the links scroll sideways; keep the current one in view
  useEffect(() => {
    const row = linksRef.current;
    const active = row?.querySelector<HTMLElement>("[aria-current=page]");
    if (row && active)
      row.scrollLeft =
        active.offsetLeft - row.offsetLeft + active.offsetWidth - row.clientWidth;
  }, [pathname]);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-line bg-background/85 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-baseline gap-2.5">
          <span className="font-display whitespace-nowrap text-[13px] font-extrabold uppercase tracking-[0.02em] text-foreground sm:text-[15px]">
            Visual Bible
          </span>
          <span
            className="hidden text-[12px] font-medium text-accent sm:inline"
            dir="rtl"
          >
            תולדות
          </span>
        </Link>
        <div
          ref={linksRef}
          className="ml-4 flex min-w-0 items-center gap-4 overflow-x-auto [scrollbar-width:none] sm:gap-7"
        >
          {links.map(({ href, label, match }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : href.includes("?")
                  ? false
                  : (match ?? [href]).some((m) => pathname.startsWith(m));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`micro-label shrink-0 transition-colors ${
                  active
                    ? "text-accent"
                    : "text-faint hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

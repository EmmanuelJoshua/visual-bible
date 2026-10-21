"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/genealogy", label: "Genealogy" },
  { href: "/timeline", label: "Timeline" },
  { href: "/artifacts", label: "Models" },
];

export function SiteNav() {
  const pathname = usePathname();

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
        <div className="flex items-center gap-4 sm:gap-7">
          {links.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`micro-label transition-colors ${
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

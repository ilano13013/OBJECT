import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { Wordmark } from "./Wordmark";

const LINKS = [
  { href: "#demos", label: "Demos" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { mode, user } = useAuth();
  const { pathname } = useLocation();
  const onLanding = pathname === "/";
  return (
    <header
      className={`gutter fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between transition-[background-color,backdrop-filter] duration-500 md:h-20 ${
        scrolled ? "bg-obsidian/70 backdrop-blur-xl" : ""
      }`}
    >
      <Link to="/" className="text-xl md:text-2xl" aria-label="OBJECT. home">
        <Wordmark />
      </Link>
      <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
        {onLanding ? (
          LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-silver transition-colors hover:text-porcelain"
            >
              {l.label}
            </a>
          ))
        ) : (
          <Link
            to="/"
            className="text-sm text-silver transition-colors hover:text-porcelain"
          >
            Home
          </Link>
        )}
        <Link
          to="/gallery"
          aria-current={pathname === "/gallery" ? "page" : undefined}
          className="text-sm text-silver transition-colors hover:text-porcelain aria-[current=page]:text-porcelain"
        >
          Gallery
        </Link>
      </nav>
      <div className="flex items-center gap-1 sm:gap-3">
        <Link
          to="/gallery"
          className="inline-flex min-h-11 items-center px-2 text-sm text-silver transition-colors hover:text-porcelain md:hidden"
        >
          Gallery
        </Link>
        {user ? (
          <Link
            to="/studio"
            className="inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold text-obsidian bg-porcelain transition-colors hover:bg-lime"
          >
            Open the studio
          </Link>
        ) : (
          <div className="flex items-center gap-1 sm:gap-3">
            {mode === "cloud" && (
              <Link
                to="/login"
                className="hidden min-h-11 items-center px-3 sm:inline-flex text-sm text-silver transition-colors hover:text-porcelain"
              >
                Sign in
              </Link>
            )}
            <Link
              to="/login?mode=signup"
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-5 text-sm font-semibold text-obsidian bg-porcelain transition-colors hover:bg-lime"
            >
              Create an account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

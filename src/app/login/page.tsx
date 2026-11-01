import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { LoginShowcase } from "./login-showcase";
import { Logo, ThemeToggle } from "@/components/ui/brand";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="relative flex flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
        <header className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] animate-rise">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <footer className="flex flex-col gap-2 text-[12px] text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 {BRAND.name}. All rights reserved.</span>
          <nav className="flex gap-4">
            <a href="#" className="hover:text-ink">Privacy</a>
            <a href="#" className="hover:text-ink">Terms</a>
            <a href="#" className="hover:text-ink">Status</a>
          </nav>
        </footer>
      </section>

      <LoginShowcase />
    </main>
  );
}

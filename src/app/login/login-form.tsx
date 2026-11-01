"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { login } from "@/lib/api/employees";

/** Only allow same-origin relative paths as a post-login destination. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [retryIn, setRetryIn] = useState(0);

  useEffect(() => {
    if (retryIn <= 0) return;
    const t = setTimeout(() => setRetryIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [retryIn]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid work email.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    const res = await login(email.trim(), password);
    if (res.ok) {
      router.replace(safeNext(params.get("next")));
      router.refresh();
      return;
    }
    setLoading(false);
    if (res.status === 429) {
      setRetryIn(res.retryAfter ?? 60);
      setErrors({});
    } else if (res.status === 422) {
      setErrors({ email: res.errors?.email?.[0], password: res.errors?.password?.[0], form: res.errors ? undefined : res.message });
    } else {
      setErrors({ form: res.message ?? "Couldn't sign you in. Please try again." });
    }
  }

  const blocked = retryIn > 0;

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-[44px] leading-[1.02] tracking-tight text-ink sm:text-5xl">
          Welcome <span className="italic text-ink-3">back.</span>
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">Sign in to manage your team, time and pay — all in one place.</p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        {blocked && (
          <p role="alert" className="tabular rounded-xl bg-warn-soft px-3.5 py-3 text-[13px] font-medium text-warn">
            Too many attempts. Try again in {retryIn} second{retryIn === 1 ? "" : "s"}.
          </p>
        )}
        {errors.form && (
          <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] font-medium text-bad">
            {errors.form}
          </p>
        )}

        <Field label="Work email" htmlFor="email" error={errors.email}>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!errors.email}
              className="pl-10"
              placeholder="you@company.com"
            />
          </div>
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint={
            <a href="#" className="text-[13px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              Forgot?
            </a>
          }
        >
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              invalid={!!errors.password}
              className="pr-11 pl-10"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-1.5 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {capsLock && <p className="text-[12px] font-medium text-warn">Caps Lock is on</p>}
        </Field>

        <Button type="submit" variant="primary" size="lg" className="group w-full justify-center" disabled={loading || blocked}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-3">You stay signed in on this device for 7 days.</p>
    </>
  );
}

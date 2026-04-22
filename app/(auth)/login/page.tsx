"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.05] xl:grid-cols-[1.08fr,0.92fr]">
        <section className="p-8 md:p-12 xl:p-16">
          <div className="badge">
            <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
            Secure workspace sign in
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">Welcome back to ObserveX</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 md:text-base">
            Sign in to access your SaaS workspace, upload logs, inspect operational trends, and continue building your observability pipeline.
          </p>

          <form
            className="mt-8 space-y-4"
            action={(formData) =>
              startTransition(async () => {
                const result = await loginAction(formData);
                if (result?.message) setMessage(result.message);
              })
            }
          >
            <input name="email" type="email" placeholder="Work email" className="input" />
            <input name="password" type="password" placeholder="Password" className="input" />
            <button className="btn-primary w-full" disabled={pending}>
              {pending ? "Signing in..." : "Sign in"}
            </button>
            {message ? <p className="text-sm text-rose-300">{message}</p> : null}
          </form>

          <p className="mt-6 text-sm text-slate-400">
            New here?{" "}
            <Link href="/create-account" className="text-cyan-300 hover:underline">
              Create your account
            </Link>
          </p>
        </section>

        <section className="border-l border-white/10 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-violet-500/10 p-8 md:p-12 xl:p-16">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-sm uppercase tracking-[0.22em] text-cyan-300/90">Mission control</div>
            <div className="mt-4 text-3xl font-semibold">ObserveX Prime</div>
            <div className="mt-3 text-sm leading-7 text-slate-400">
              A top-end interface for log ingestion, environment-aware dashboards, security intelligence, and operational analysis.
            </div>

            <div className="mt-6 grid gap-3">
              {[
                "Workspace-aware URLs",
                "Upload real log files",
                "Generate visual metrics automatically",
                "Deploy directly to Railway"
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

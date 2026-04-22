"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { registerAction } from "@/app/actions/auth";

export default function CreateAccountPage() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.05] xl:grid-cols-[0.95fr,1.05fr]">
        <section className="border-r border-white/10 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-violet-500/10 p-8 md:p-12 xl:p-16">
          <div className="text-sm uppercase tracking-[0.22em] text-cyan-300/90">Create your workspace</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Launch your SaaS tenant in minutes</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400 md:text-base">
            Register your team, create a workspace slug, and start uploading logs into a premium, production-style observability platform.
          </p>

          <div className="mt-8 grid gap-3">
            {[
              "Auth + workspace onboarding included",
              "Premium landing and dashboard UI",
              "Real upload parsing and charts",
              "Extendable for RBAC, API connectors, and alerts"
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="p-8 md:p-12 xl:p-16">
          <div className="badge">
            <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
            Account setup
          </div>

          <form
            className="mt-6 space-y-4"
            action={(formData) =>
              startTransition(async () => {
                const result = await registerAction(formData);
                if (result?.message) setMessage(result.message);
              })
            }
          >
            <input name="name" placeholder="Full name" className="input" />
            <input name="email" type="email" placeholder="Work email" className="input" />
            <input name="workspaceName" placeholder="Workspace name (example: FSBL Ops)" className="input" />
            <input name="password" type="password" placeholder="Password (minimum 8 characters)" className="input" />
            <button className="btn-primary w-full" disabled={pending}>
              {pending ? "Creating account..." : "Create account"}
            </button>
            {message ? <p className="text-sm text-rose-300">{message}</p> : null}
          </form>

          <p className="mt-6 text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-cyan-300 hover:underline">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

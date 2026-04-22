"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(async () => await logoutAction())}
      className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white hover:bg-white/[0.08]"
    >
      {pending ? "Signing out..." : "Logout"}
    </button>
  );
}

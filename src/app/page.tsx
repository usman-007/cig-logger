"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/app/brand";
import { useStore } from "@/lib/store";

/**
 * Session state lives in localStorage, so the landing route can only decide
 * where to go once the client has hydrated.
 */
export default function EntryPage() {
  const { hydrated, session } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(session ? "/dashboard" : "/login");
  }, [hydrated, session, router]);

  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <BrandMark className="animate-pulse" />
        <span className="text-sm">Loading your tracker…</span>
      </div>
    </main>
  );
}

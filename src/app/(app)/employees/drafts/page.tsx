import type { Metadata } from "next";
import { Suspense } from "react";
import { DraftsView } from "@/components/employees/drafts-view";

export const metadata: Metadata = { title: "Drafts" };

export default function DraftsPage() {
  return (
    <Suspense>
      <DraftsView />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { View } from "./view";

export const metadata: Metadata = { title: "Shift records" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}

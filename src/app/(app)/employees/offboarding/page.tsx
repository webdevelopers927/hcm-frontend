import type { Metadata } from "next";
import { Suspense } from "react";
import { View } from "./view";

export const metadata: Metadata = { title: "Off-boarding" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}

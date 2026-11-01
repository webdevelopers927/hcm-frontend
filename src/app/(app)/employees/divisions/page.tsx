import type { Metadata } from "next";
import { LookupAdmin } from "@/components/employees/lookup-admin";

export const metadata: Metadata = { title: "Divisions" };

export default function DivisionsPage() {
  return <LookupAdmin resource="divisions" />;
}

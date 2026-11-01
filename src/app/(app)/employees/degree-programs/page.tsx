import type { Metadata } from "next";
import { LookupAdmin } from "@/components/employees/lookup-admin";

export const metadata: Metadata = { title: "Degree programs" };

export default function DegreeProgramsPage() {
  return <LookupAdmin resource="degree-programs" />;
}

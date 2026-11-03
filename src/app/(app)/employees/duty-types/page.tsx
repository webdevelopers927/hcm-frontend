import type { Metadata } from "next";
import { DutyTypesAdmin } from "@/components/employees/duty-types-admin";

export const metadata: Metadata = { title: "Duty types" };

export default function DutyTypesPage() {
  return <DutyTypesAdmin />;
}

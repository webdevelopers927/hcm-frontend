import type { Metadata } from "next";
import { EmploymentStatusesAdmin } from "@/components/employees/employment-statuses-admin";

export const metadata: Metadata = { title: "Employment statuses" };

export default function EmploymentStatusesPage() {
  return <EmploymentStatusesAdmin />;
}

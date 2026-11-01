import type { Metadata } from "next";
import { Suspense } from "react";
import { EmployeeFormPage } from "@/components/employees/form/employee-form";

export const metadata: Metadata = { title: "Add employee" };

export default function NewEmployeePage() {
  return (
    <Suspense>
      <EmployeeFormPage id={null} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmployeeFormPage } from "@/components/employees/form/employee-form";

export const metadata: Metadata = { title: "Edit employee" };

export default function EditEmployeePage({ params }: PageProps<"/employees/[id]/edit">) {
  return (
    <Suspense>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/employees/[id]/edit">["params"] }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();
  return <EmployeeFormPage id={numericId} />;
}

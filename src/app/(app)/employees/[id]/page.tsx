import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmployeeProfile } from "@/components/employees/employee-profile";

export const metadata: Metadata = { title: "Employee" };

export default function EmployeePage({ params }: PageProps<"/employees/[id]">) {
  return (
    <Suspense>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: PageProps<"/employees/[id]">["params"] }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();
  return <EmployeeProfile id={numericId} />;
}

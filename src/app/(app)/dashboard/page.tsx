import type { Metadata } from "next";
import {
  ApprovalsCard,
  AttendanceCard,
  AwayCard,
  ClockCard,
  DepartmentsCard,
  Greeting,
  HeadcountCard,
  HiringCard,
  KpiRow,
  MomentsCard,
} from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Greeting />
        </div>
        <div className="xl:col-span-4">
          <ClockCard />
        </div>
      </div>

      <KpiRow />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <HeadcountCard />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <AttendanceCard />
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <ApprovalsCard />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <AwayCard />
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        <DepartmentsCard />
        <HiringCard />
        <div className="md:col-span-2 xl:col-span-1">
          <MomentsCard />
        </div>
      </div>
    </div>
  );
}

import { DataTable } from "@/components/shared/table/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";

const data = [
  {
    student: "Veda Varshit",
    leaveType: "Long Leave",
    hostel: "Hostel A",
    status: "pending",
  },
  {
    student: "Rahul",
    leaveType: "Internship",
    hostel: "Hostel B",
    status: "approved",
  },
  {
    student: "Ananya",
    leaveType: "Late Entry",
    hostel: "Hostel A",
    status: "rejected",
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Admin Dashboard
        </h1>

        <p className="mt-2 text-muted-foreground">
          Manage leave approvals and movement workflows.
        </p>
      </div>

      <DataTable
        data={data}
        columns={[
          {
            key: "student",
            header: "Student",
          },
          {
            key: "leaveType",
            header: "Leave Type",
          },
          {
            key: "hostel",
            header: "Hostel",
          },
          {
            key: "status",
            header: "Status",
            render: (value) => (
              <StatusBadge
                status={
                  value as
                    | "approved"
                    | "pending"
                    | "rejected"
                }
              />
            ),
          },
        ]}
      />
    </div>
  );
}
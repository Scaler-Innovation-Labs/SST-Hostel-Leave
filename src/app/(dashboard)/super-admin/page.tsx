import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

export default function SuperAdminPage() {
  redirect(ROUTES.SUPER_ADMIN_DASHBOARD);
}

import { redirect } from "next/navigation";
import { isOperatorSignedIn } from "@/server/operator-auth";
import { Dashboard } from "./dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await isOperatorSignedIn())) redirect("/login");
  return <Dashboard />;
}

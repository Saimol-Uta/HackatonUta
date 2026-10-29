import { redirect } from "next/navigation";
import { isOperatorSignedIn } from "@/server/operator-auth";
import { Shell } from "./shell";

export const dynamic = "force-dynamic";

/** Every dashboard view requires an operator session. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isOperatorSignedIn())) redirect("/login");
  return <Shell>{children}</Shell>;
}

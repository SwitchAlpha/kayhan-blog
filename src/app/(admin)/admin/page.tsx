export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
export default function AdminHome() { redirect("/admin/posts"); }

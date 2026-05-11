import { redirect } from "next/navigation";

export default function TriagePage() {
  redirect("/users?filter=pending");
}

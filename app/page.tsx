import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Dashboard Overview",
  description: "McGill Library Dashboard",
};

export default async function Home() {
    redirect("/auth/login");
}

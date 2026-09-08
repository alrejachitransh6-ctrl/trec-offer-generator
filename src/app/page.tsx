import { redirect } from "next/navigation";

import { getUser } from "@/lib/supabase/auth";

/** The bare origin is the entry point: straight to the app or to sign-in. */
export default async function Home() {
  const user = await getUser();
  redirect(user ? "/lookup" : "/login");
}

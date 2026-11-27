import { LoginForm } from "./login-form";
import { ui } from "@/components/ui";

export const metadata = { title: "Staff login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/admin", error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className={`${ui.card} w-full max-w-sm`}>
        <h1 className={ui.h1}>Ranjan Tutorials</h1>
        <p className={`${ui.muted} mb-6`}>Staff login · Attendance</p>
        <LoginForm next={next} notStaff={error === "not-staff"} />
      </div>
    </main>
  );
}

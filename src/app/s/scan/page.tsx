import { requireStudent } from "@/lib/student-session";
import { Scanner } from "./scanner";

export const metadata = { title: "Check in" };
export const dynamic = "force-dynamic";

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await requireStudent();
  const { t } = await searchParams;
  return <Scanner initialToken={t ?? null} />;
}

import { requireStaff } from "@/lib/auth";
import { KioskQr } from "./kiosk-qr";

export const metadata = { title: "Kiosk" };

export default async function KioskPage() {
  await requireStaff();
  return <KioskQr />;
}

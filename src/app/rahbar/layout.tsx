import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/rahbar", label: "Bugun" },
  { href: "/rahbar/menyu", label: "Menyu" },
  { href: "/rahbar/bolalar", label: "Bolalar" },
  { href: "/rahbar/sozlamalar", label: "Sozlamalar" },
] as const;

export default async function RahbarLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOwner();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <nav className="flex gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-500 sm:inline">{user.fullName}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

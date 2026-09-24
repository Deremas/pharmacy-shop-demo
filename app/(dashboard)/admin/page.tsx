"use client";

import React from "react";
import Link from "next/link";
import { Users, Shield, Settings, BarChart3 } from "lucide-react";
import { useSession } from "next-auth/react";

const adminCards = [
  { title: "Reports", description: "Per-pharmacy sales, stock, and finance reports. Switch branch in the top bar.", icon: BarChart3, href: "/reports", permission: "reports.view" },
  { title: "User Management", description: "Global users for every pharmacy. Assign each person to one or more branches.", icon: Users, href: "/admin/users", permission: "admin.users.view" },
  { title: "Role Management", description: "Global roles and permissions shared across all pharmacy branches.", icon: Shield, href: "/admin/roles", permission: "admin.roles.view" },
  { title: "System Settings", description: "Profile for the pharmacy currently selected in the top bar.", icon: Settings, href: "/admin/settings", permission: "admin.settings.view" },
];

export default function AdminPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const permissionKeys = new Set<string>(user?.permissions || []);
  const can = (permission: string) => user?.role === "Super Admin" || permissionKeys.has(permission);
  const visibleCards = adminCards.filter((card) => can(card.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">System Administration</h1>
        <p className="text-slate-500 mt-1">Users and roles are global. Reports, stock, sales, and finance follow the business selected in the top bar.</p>
      </div>

      {visibleCards.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
          No administration tools are available for your role.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleCards.map((card) => (
            <AdminCard key={card.href} {...card} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminCard({ title, description, icon: Icon, href }: any) {
  return (
    <Link href={href} className="block bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-xl hover:shadow-md transition-all">
      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl w-fit mb-4">
        <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h4 className="font-bold text-slate-900 dark:text-white mb-1">{title}</h4>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </Link>
  );
}

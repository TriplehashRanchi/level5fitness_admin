"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { adherencePercent, fmtKg, GOAL_LABEL } from "@/lib/body";
import { Alert, Avatar, Badge, EmptyState, Input, PageHeader, PageSpinner } from "@/components/ui";

export default function ClientsPage() {
  const { staff } = useAuth();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  // Search after a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, error } = useApi(`/dietitian/clients${search ? `?q=${encodeURIComponent(search)}` : ""}`);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={
          staff.role === "admin"
            ? "Every member who finished setup and agreed to share with a dietitian."
            : "Members assigned to you. Open one to see their details and post a diet plan."
        }
      />
      <div className="mb-5 max-w-md">
        <Input type="search" placeholder="Search by name or email" aria-label="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {error ? <Alert>{messageOf(error)}</Alert> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data && data.clients.length === 0 ? (
        <EmptyState title={search ? "No clients match" : "No clients yet"}>
          {search
            ? "Try another name or email."
            : staff.role === "admin"
              ? "Members appear here after they finish the setup questions and agree to share."
              : "The admin has not assigned any members to you yet."}
        </EmptyState>
      ) : null}
      {data && data.clients.length > 0 ? (
        <div className="overflow-x-auto rounded-3xl border border-line bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">Goal</th>
                <th className="px-5 py-3 font-semibold">Weight</th>
                <th className="px-5 py-3 font-semibold">Plan, last 7 days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.clients.map((c) => {
                const percent = adherencePercent(c.done7, c.planned7);
                return (
                  <tr key={c.id} className="transition hover:bg-white/5">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${encodeURIComponent(c.id)}`} className="flex items-center gap-3">
                        <Avatar name={c.name || c.email} image={c.image} />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-white">{c.name || c.email}</span>
                          <span className="block truncate text-xs text-muted">{c.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3"><Badge tone="brand">{GOAL_LABEL[c.goal]}</Badge></td>
                    <td className="px-5 py-3 text-zinc-300">{fmtKg(c.weightKg)} <span className="text-muted">→ {fmtKg(c.targetWeightKg)}</span></td>
                    <td className="px-5 py-3">
                      {percent == null ? <Badge tone="warn">No plan</Badge> : <Badge tone={percent >= 70 ? "good" : "neutral"}>{percent}% · {c.done7}/{c.planned7}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

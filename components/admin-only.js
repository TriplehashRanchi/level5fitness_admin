"use client";

import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";

/** The API refuses everyone but the admin anyway; this just keeps dietitians from seeing a broken page. */
export default function AdminOnly({ children }) {
  const { staff } = useAuth();
  if (staff.role !== "admin") return <Alert>This page is only for the admin.</Alert>;
  return children;
}

import { Suspense } from "react";
import ConsoleGate from "@/components/console-gate";

// Everything in the console is private and loaded after sign-in, in the browser. The Suspense
// boundary is what lets the page shell be prerendered while the signed-in part waits for the user.
export default function ConsoleLayout({ children }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted" role="status">
          Loading…
        </div>
      }
    >
      <ConsoleGate>{children}</ConsoleGate>
    </Suspense>
  );
}

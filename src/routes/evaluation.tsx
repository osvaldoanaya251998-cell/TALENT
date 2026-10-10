import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/evaluation")({
  beforeLoad: () => { throw redirect({ to: "/jobs", replace: true }); },
});

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/evaluation-result")({
  beforeLoad: () => { throw redirect({ to: "/jobs", replace: true }); },
});

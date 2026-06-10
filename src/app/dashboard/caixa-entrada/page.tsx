import { redirect } from "next/navigation";

export default function CaixaEntradaRedirect({
  searchParams,
}: {
  searchParams: { assignee?: string };
}) {
  const qs = searchParams?.assignee ? `?assignee=${searchParams.assignee}` : "";
  redirect(`/dashboard/consultivo${qs}`);
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { buildProcessWhere } from "@/lib/reports";
import { statusBadgeClass, statusLabel } from "@/lib/utils";
import ReportActions from "@/components/ReportActions";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: { de?: string; ate?: string; tipo?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const filters = {
    de: searchParams.de,
    ate: searchParams.ate,
    tipo: searchParams.tipo,
    status: searchParams.status,
  };
  const where = buildProcessWhere(filters);

  const processes = await prisma.process.findMany({
    where,
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const summary = {
    total: processes.length,
    administrativo: processes.filter((p) => p.type === "ADMINISTRATIVO").length,
    judicial: processes.filter((p) => p.type === "JUDICIAL").length,
    ativo: processes.filter((p) => p.status === "ATIVO").length,
    concluido: processes.filter((p) => p.status === "CONCLUIDO").length,
    arquivado: processes.filter((p) => p.status === "ARQUIVADO").length,
    comPrazo: processes.filter((p) => p.deadline).length,
    expirados: processes.filter((p) => p.deadline && new Date(p.deadline) < now && p.status === "ATIVO").length,
  };

  // query string para exportação (mesmos filtros aplicados)
  const qp = new URLSearchParams();
  if (filters.de) qp.set("de", filters.de);
  if (filters.ate) qp.set("ate", filters.ate);
  if (filters.tipo) qp.set("tipo", filters.tipo);
  if (filters.status) qp.set("status", filters.status);
  const query = qp.toString();

  const cards = [
    { label: "Total", value: summary.total, accent: "text-navy-800" },
    { label: "Administrativos", value: summary.administrativo, accent: "text-navy-700" },
    { label: "Judiciais", value: summary.judicial, accent: "text-navy-700" },
    { label: "Ativos", value: summary.ativo, accent: "text-emerald-700" },
    { label: "Concluídos", value: summary.concluido, accent: "text-stone-600" },
    { label: "Arquivados", value: summary.arquivado, accent: "text-stone-500" },
    { label: "Com prazo fatal", value: summary.comPrazo, accent: "text-amber-700" },
    { label: "Prazo expirado", value: summary.expirados, accent: "text-red-700" },
  ];

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1">Gestão</p>
          <h1 className="page-title">Relatórios</h1>
          <p className="text-stone-500 text-sm mt-1">
            Resumo gerencial dos processos. Exporte para Excel ou imprima em PDF.
          </p>
        </div>
        <ReportActions query={query} />
      </div>

      {/* Filtros */}
      <form method="get" className="card p-5 mb-6 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="field-label">De</label>
            <input type="date" name="de" defaultValue={filters.de ?? ""} className="input" />
          </div>
          <div>
            <label className="field-label">Até</label>
            <input type="date" name="ate" defaultValue={filters.ate ?? ""} className="input" />
          </div>
          <div>
            <label className="field-label">Tipo</label>
            <select name="tipo" defaultValue={filters.tipo ?? ""} className="input">
              <option value="">Todos</option>
              <option value="ADMINISTRATIVO">Administrativo</option>
              <option value="JUDICIAL">Judicial</option>
            </select>
          </div>
          <div>
            <label className="field-label">Status</label>
            <select name="status" defaultValue={filters.status ?? ""} className="input">
              <option value="">Todos</option>
              <option value="ATIVO">Ativo</option>
              <option value="CONCLUIDO">Concluído</option>
              <option value="ARQUIVADO">Arquivado</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">Aplicar</button>
            <a href="/dashboard/relatorios" className="btn-ghost">Limpar</a>
          </div>
        </div>
      </form>

      {/* Cabeçalho de impressão (só no PDF) */}
      <div className="hidden print:block mb-4">
        <h2 className="text-lg font-semibold">Relatório de Processos</h2>
        <p className="text-sm text-stone-600">
          Gerado em {format(now, "dd/MM/yyyy HH:mm")}
          {filters.de && ` · de ${filters.de}`}
          {filters.ate && ` até ${filters.ate}`}
          {filters.tipo && ` · tipo ${filters.tipo}`}
          {filters.status && ` · status ${filters.status}`}
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                <th className="px-6 py-3 font-medium">Nº Processo</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium">Assunto</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Cadastrado por</th>
                <th className="px-6 py-3 font-medium">Criado em</th>
                <th className="px-6 py-3 font-medium">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {processes.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-stone-400">Nenhum processo no filtro selecionado.</td></tr>
              )}
              {processes.map((p, i) => (
                <tr key={p.id} className={`border-b border-stone-100 ${i % 2 === 0 ? "bg-white" : "bg-[#f7f5ef]"}`}>
                  <td className="px-6 py-3 font-mono font-semibold text-navy-700">{p.number}</td>
                  <td className="px-6 py-3 text-stone-600">{p.type === "JUDICIAL" ? "Judicial" : "Administrativo"}</td>
                  <td className="px-6 py-3 max-w-xs truncate">{p.subject}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(p.status)}`}>
                      {statusLabel(p.status)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-stone-600">{p.createdBy.name}</td>
                  <td className="px-6 py-3 text-stone-500 text-xs">{format(new Date(p.createdAt), "dd/MM/yyyy")}</td>
                  <td className="px-6 py-3 text-stone-500 text-xs">{p.deadline ? format(new Date(p.deadline), "dd/MM/yyyy") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

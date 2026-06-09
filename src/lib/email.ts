import nodemailer from "nodemailer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
  },
});

function fmt(date: Date | string) {
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

export async function sendMovementEmail(opts: {
  to: string[];
  bcc?: string[];
  processNumber: string;
  processSubject: string;
  movementDescription: string;
  movedBy: string;
  attachments?: { filename: string; path: string }[];
}) {
  const attachmentsList = opts.attachments?.length
    ? `<div style="margin-top:16px">
         <p style="color:#374151;font-weight:bold;margin-bottom:6px">📎 Documentos anexados:</p>
         <ul style="margin:0;color:#374151">
           ${opts.attachments.map((a) => `<li>${a.filename}</li>`).join("")}
         </ul>
       </div>`
    : "";

  await transporter.sendMail({
    from: `"Gestão de Processos" <${process.env.EMAIL_FROM}>`,
    to: opts.to.join(", "),
    bcc: opts.bcc?.length ? opts.bcc.join(", ") : undefined,
    subject: `[Processo ${opts.processNumber}] Nova movimentação`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Nova Movimentação de Processo</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:140px">Processo:</td>
              <td style="padding:8px;font-weight:bold">${opts.processNumber}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Assunto:</td>
              <td style="padding:8px">${opts.processSubject}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Movimentado por:</td>
              <td style="padding:8px">${opts.movedBy}</td></tr>
        </table>
        <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-top:16px">
          <p style="margin:0;color:#374151">${opts.movementDescription}</p>
        </div>
        ${attachmentsList}
        <hr style="margin-top:24px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">Sistema de Gestão de Processos Administrativos</p>
      </div>`,
    attachments: opts.attachments,
  });
}

export async function sendDeadlineWarningEmail(opts: {
  to: string[];
  processNumber: string;
  processSubject: string;
  deadline: Date | string;
  daysLeft: number;
}) {
  const isExpired = opts.daysLeft < 0;
  const subject = isExpired
    ? `[PRAZO EXPIRADO] Processo ${opts.processNumber}`
    : `[ATENÇÃO] Processo ${opts.processNumber} vence em ${opts.daysLeft} dia(s)`;

  await transporter.sendMail({
    from: `"Gestão de Processos" <${process.env.EMAIL_FROM}>`,
    to: opts.to.join(", "),
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:${isExpired ? "#dc2626" : "#d97706"}">
          ${isExpired ? "Prazo Expirado!" : `Prazo se aproximando — ${opts.daysLeft} dia(s)`}
        </h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:140px">Processo:</td>
              <td style="padding:8px;font-weight:bold">${opts.processNumber}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Assunto:</td>
              <td style="padding:8px">${opts.processSubject}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Prazo fatal:</td>
              <td style="padding:8px;font-weight:bold;color:${isExpired ? "#dc2626" : "#d97706"}">${fmt(opts.deadline)}</td></tr>
        </table>
        <hr style="margin-top:24px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">Sistema de Gestão de Processos Administrativos</p>
      </div>`,
  });
}

function attachmentsBlock(attachments?: { filename: string; path: string }[]) {
  if (!attachments?.length) return "";
  return `<div style="margin-top:16px">
       <p style="color:#374151;font-weight:bold;margin-bottom:6px">📎 Documentos anexados:</p>
       <ul style="margin:0;color:#374151">
         ${attachments.map((a) => `<li>${a.filename}</li>`).join("")}
       </ul>
     </div>`;
}

export async function sendTaskAssignedEmail(opts: {
  to: string;
  toName: string;
  fromName: string;
  taskTitle: string;
  taskDescription?: string | null;
  deadline: Date | string;
  attachments?: { filename: string; path: string }[];
}) {
  await transporter.sendMail({
    from: `"Gestão de Processos" <${process.env.EMAIL_FROM}>`,
    to: opts.to,
    subject: `[Nova Tarefa] ${opts.taskTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Nova Tarefa Atribuída</h2>
        <p>Olá, <strong>${opts.toName}</strong>.</p>
        <p><strong>${opts.fromName}</strong> atribuiu uma nova tarefa para você:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:8px;color:#6b7280;width:140px">Tarefa:</td>
              <td style="padding:8px;font-weight:bold">${opts.taskTitle}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Prazo:</td>
              <td style="padding:8px;color:#d97706;font-weight:bold">${fmt(opts.deadline)}</td></tr>
          ${opts.taskDescription ? `<tr><td style="padding:8px;color:#6b7280">Descrição:</td>
              <td style="padding:8px">${opts.taskDescription}</td></tr>` : ""}
        </table>
        ${attachmentsBlock(opts.attachments)}
        <hr style="margin-top:24px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">Sistema de Gestão de Processos Administrativos</p>
      </div>`,
    attachments: opts.attachments,
  });
}

export async function sendTaskMovementEmail(opts: {
  to: string[];
  taskTitle: string;
  movementDescription: string;
  movedBy: string;
  deadline: Date | string;
  attachments?: { filename: string; path: string }[];
}) {
  await transporter.sendMail({
    from: `"Gestão de Processos" <${process.env.EMAIL_FROM}>`,
    to: opts.to.join(", "),
    subject: `[Tarefa] Nova movimentação: ${opts.taskTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Movimentação de Tarefa</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:140px">Tarefa:</td>
              <td style="padding:8px;font-weight:bold">${opts.taskTitle}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Prazo:</td>
              <td style="padding:8px;color:#d97706;font-weight:bold">${fmt(opts.deadline)}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Atualizado por:</td>
              <td style="padding:8px">${opts.movedBy}</td></tr>
        </table>
        <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-top:16px">
          <p style="margin:0;color:#374151">${opts.movementDescription}</p>
        </div>
        ${attachmentsBlock(opts.attachments)}
        <hr style="margin-top:24px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">Sistema de Gestão de Processos Administrativos</p>
      </div>`,
    attachments: opts.attachments,
  });
}

export async function sendTaskAvailableEmail(opts: {
  to: string[];
  fromName: string;
  taskTitle: string;
  taskDescription?: string | null;
  deadline: Date | string;
}) {
  if (!opts.to.length) return;
  await transporter.sendMail({
    from: `"Gestão de Processos" <${process.env.EMAIL_FROM}>`,
    to: opts.to.join(", "),
    subject: `[Tarefa disponível] ${opts.taskTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Nova tarefa disponível</h2>
        <p><strong>${opts.fromName}</strong> abriu uma tarefa <strong>sem responsável definido</strong>. Quem puder assumir, acesse o sistema e clique em <strong>"Reivindicar"</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:8px;color:#6b7280;width:140px">Tarefa:</td>
              <td style="padding:8px;font-weight:bold">${opts.taskTitle}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Prazo:</td>
              <td style="padding:8px;color:#d97706;font-weight:bold">${fmt(opts.deadline)}</td></tr>
          ${opts.taskDescription ? `<tr><td style="padding:8px;color:#6b7280">Descrição:</td><td style="padding:8px">${opts.taskDescription}</td></tr>` : ""}
        </table>
        <hr style="margin-top:24px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">Sistema de Gestão de Processos Administrativos</p>
      </div>`,
  });
}

export async function sendTaskCompletedEmail(opts: {
  to: string[];
  taskTitle: string;
  completedBy: string;
  deadline: Date | string;
}) {
  if (!opts.to.length) return;
  await transporter.sendMail({
    from: `"Gestão de Processos" <${process.env.EMAIL_FROM}>`,
    to: opts.to.join(", "),
    subject: `[Tarefa concluída] ${opts.taskTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:#047857">Tarefa concluída ✓</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:140px">Tarefa:</td>
              <td style="padding:8px;font-weight:bold">${opts.taskTitle}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Concluída por:</td>
              <td style="padding:8px">${opts.completedBy}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Prazo:</td>
              <td style="padding:8px">${fmt(opts.deadline)}</td></tr>
        </table>
        <hr style="margin-top:24px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">Sistema de Gestão de Processos Administrativos</p>
      </div>`,
  });
}

export async function sendTaskClaimedEmail(opts: {
  to: string[];
  taskTitle: string;
  claimedBy: string;
  deadline: Date | string;
}) {
  if (!opts.to.length) return;
  await transporter.sendMail({
    from: `"Gestão de Processos" <${process.env.EMAIL_FROM}>`,
    to: opts.to.join(", "),
    subject: `[Tarefa reivindicada] ${opts.taskTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Tarefa reivindicada</h2>
        <p><strong>${opts.claimedBy}</strong> assumiu a tarefa que estava sem responsável:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:8px">
          <tr><td style="padding:8px;color:#6b7280;width:140px">Tarefa:</td>
              <td style="padding:8px;font-weight:bold">${opts.taskTitle}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Prazo:</td>
              <td style="padding:8px">${fmt(opts.deadline)}</td></tr>
        </table>
        <hr style="margin-top:24px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">Sistema de Gestão de Processos Administrativos</p>
      </div>`,
  });
}

export async function sendHearingEmail(opts: {
  to: string;
  processNumber: string;
  processSubject: string;
  hearingType: string;
  hearingTitle: string;
  hearingDateTime: Date | string;
  hearingLocation?: string | null;
  hearingDescription?: string | null;
  addedBy: string;
}) {
  const typeLabel: Record<string, string> = {
    AUDIENCIA: "Audiência",
    REUNIAO: "Reunião",
    PRAZO: "Prazo",
    DILIGENCIA: "Diligência",
    OUTRO: "Outro",
  };
  const label = typeLabel[opts.hearingType] ?? opts.hearingType;
  const dateFormatted = format(new Date(opts.hearingDateTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  await transporter.sendMail({
    from: `"Gestão de Processos" <${process.env.EMAIL_FROM}>`,
    to: opts.to,
    subject: `[${label}] ${opts.hearingTitle} — Processo ${opts.processNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Novo Compromisso Agendado</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:140px">Tipo:</td>
              <td style="padding:8px;font-weight:bold">${label}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Título:</td>
              <td style="padding:8px;font-weight:bold">${opts.hearingTitle}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Processo:</td>
              <td style="padding:8px">${opts.processNumber} — ${opts.processSubject}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Data/Hora:</td>
              <td style="padding:8px;font-weight:bold;color:#1e40af">${dateFormatted}</td></tr>
          ${opts.hearingLocation ? `<tr><td style="padding:8px;color:#6b7280">Local:</td>
              <td style="padding:8px">${opts.hearingLocation}</td></tr>` : ""}
          ${opts.hearingDescription ? `<tr><td style="padding:8px;color:#6b7280">Observações:</td>
              <td style="padding:8px">${opts.hearingDescription}</td></tr>` : ""}
          <tr><td style="padding:8px;color:#6b7280">Agendado por:</td>
              <td style="padding:8px">${opts.addedBy}</td></tr>
        </table>
        <div style="margin-top:16px;padding:12px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px">
          <p style="margin:0;font-size:13px;color:#1e40af">
            Um evento foi criado no Google Agenda com lembretes 7 dias, 3 dias e no dia do compromisso.
          </p>
        </div>
        <hr style="margin-top:24px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">Sistema de Gestão de Processos Administrativos</p>
      </div>`,
  });
}

export async function sendTaskDeadlineEmail(opts: {
  to: string;
  toName: string;
  taskTitle: string;
  deadline: Date | string;
  daysLeft: number;
}) {
  const isExpired = opts.daysLeft < 0;
  await transporter.sendMail({
    from: `"Gestão de Processos" <${process.env.EMAIL_FROM}>`,
    to: opts.to,
    subject: isExpired
      ? `[PRAZO EXPIRADO] Tarefa: ${opts.taskTitle}`
      : `[ATENÇÃO] Tarefa vence em ${opts.daysLeft} dia(s): ${opts.taskTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:${isExpired ? "#dc2626" : "#d97706"}">
          ${isExpired ? "Prazo da Tarefa Expirado!" : `Tarefa vence em ${opts.daysLeft} dia(s)`}
        </h2>
        <p>Olá, <strong>${opts.toName}</strong>.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:140px">Tarefa:</td>
              <td style="padding:8px;font-weight:bold">${opts.taskTitle}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Prazo:</td>
              <td style="padding:8px;font-weight:bold;color:${isExpired ? "#dc2626" : "#d97706"}">${fmt(opts.deadline)}</td></tr>
        </table>
        <hr style="margin-top:24px;border-color:#e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px">Sistema de Gestão de Processos Administrativos</p>
      </div>`,
  });
}

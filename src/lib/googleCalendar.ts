import { google } from "googleapis";

const CALENDAR_ID = "primary";
const INVITE_EMAIL = "contencioso@cpaadvogados.com.br";

function getCalendar() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth: oauth2 });
}

// Define horário do evento: 09:00–10:00 no fuso de Recife (UTC-3)
function buildTimes(date: Date) {
  const d = new Date(date);
  // Seta para 12:00 UTC = 09:00 em Recife (UTC-3)
  d.setUTCHours(12, 0, 0, 0);
  const start = d.toISOString();
  const endD = new Date(d.getTime() + 60 * 60 * 1000);
  const end = endD.toISOString();
  return { start, end };
}

// ─── Prazo de processo ────────────────────────────────────────────────────────

export async function createDeadlineEvent(params: {
  number: string;
  subject: string;
  deadline: Date;
}): Promise<string | null> {
  try {
    const calendar = getCalendar();
    const { start, end } = buildTimes(params.deadline);

    const res = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `PRAZO – ${params.number} – ${params.subject}`,
        description: `Prazo processual – processo ${params.number}`,
        start: { dateTime: start, timeZone: "America/Recife" },
        end: { dateTime: end, timeZone: "America/Recife" },
        attendees: [{ email: INVITE_EMAIL }],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 60 },
          ],
        },
      },
    });
    return res.data.id ?? null;
  } catch (e) {
    console.error("[Google Calendar] createDeadlineEvent error:", e);
    return null;
  }
}

export async function updateDeadlineEvent(
  eventId: string,
  params: { number: string; subject: string; deadline: Date },
): Promise<boolean> {
  try {
    const calendar = getCalendar();
    const { start, end } = buildTimes(params.deadline);

    await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: {
        summary: `PRAZO – ${params.number} – ${params.subject}`,
        start: { dateTime: start, timeZone: "America/Recife" },
        end: { dateTime: end, timeZone: "America/Recife" },
      },
    });
    return true;
  } catch (e) {
    console.error("[Google Calendar] updateDeadlineEvent error:", e);
    return false;
  }
}

// ─── Audiência / evento de processo ──────────────────────────────────────────

const HEARING_TYPE_LABEL: Record<string, string> = {
  AUDIENCIA: "Audiência",
  REUNIAO: "Reunião",
  PRAZO: "Prazo",
  DILIGENCIA: "Diligência",
  OUTRO: "Evento",
};

export async function createHearingEvent(params: {
  processNumber: string;
  title: string;
  type: string;
  dateTime: Date;
  location?: string | null;
  description?: string | null;
}): Promise<string | null> {
  try {
    const calendar = getCalendar();
    const typeLabel = HEARING_TYPE_LABEL[params.type] ?? params.type;
    const start = params.dateTime.toISOString();
    const end = new Date(params.dateTime.getTime() + 60 * 60 * 1000).toISOString();

    const res = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `${typeLabel} – ${params.processNumber} – ${params.title}`,
        description: params.description || undefined,
        location: params.location || undefined,
        start: { dateTime: start, timeZone: "America/Recife" },
        end: { dateTime: end, timeZone: "America/Recife" },
        attendees: [{ email: INVITE_EMAIL }],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 30 },
          ],
        },
      },
    });
    return res.data.id ?? null;
  } catch (e) {
    console.error("[Google Calendar] createHearingEvent error:", e);
    return null;
  }
}

// ─── Genérico: apagar qualquer evento ────────────────────────────────────────

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const calendar = getCalendar();
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
    return true;
  } catch (e) {
    console.error("[Google Calendar] deleteCalendarEvent error:", e);
    return false;
  }
}

import { subs, getSender, rand, localToday, dayKey } from "../lib/core.mjs";

const HOUR = 60 * 60 * 1000;

// Si a estas horas todavía no ha escrito nada, se le recuerda con cariño.
const NUDGES = [
  { from: [12, 0], to: [13, 0], body: "Escríbelo y te lo recuerdo durante el día." },
  { from: [17, 30], to: [18, 30], body: "Todavía estás a tiempo de escribirlo." },
];

// iPhone ya muestra "from Recordar hoy" debajo, así que el título dice de qué se trata.
// Corre cada 5 minutos: manda la pregunta de la mañana y los recordatorios que ya tocan.
export default async () => {
  const store = subs();
  const push = await getSender();
  const now = Date.now();
  const { blobs } = await store.list();

  const work = blobs.map(async ({ key }) => {
    const rec = await store.get(key, { type: "json" });
    if (!rec?.subscription) return;
    const tz = rec.tz || "UTC";
    const today = dayKey(tz, now);
    let changed = false;
    const out = [];

    if (rec.morningDay !== today) {
      const from = localToday(tz, now, 6, 30);
      const to = localToday(tz, now, 9, 0);
      rec.morningDay = today;
      rec.morningAt = rand(from, to);
      rec.morningSent = now > to;
      changed = true;
    }
    if (!rec.morningSent && now >= rec.morningAt) {
      // Si ya escribió antes de la hora sorpresa, la pregunta sobra.
      if (rec.intentionDay !== today) out.push({ title: "Buenos días", body: "¿Qué quieres recordar hoy?", tag: "morning" });
      rec.morningSent = true;
      changed = true;
    }
    if (rec.nudgeDay !== today) {
      rec.nudgeDay = today;
      rec.nudges = NUDGES.map((n) => {
        const to = localToday(tz, now, ...n.to);
        return { at: rand(localToday(tz, now, ...n.from), to), sent: now > to };
      });
      changed = true;
    }
    rec.nudges.forEach((n, i) => {
      if (n.sent || now < n.at) return;
      if (rec.intentionDay !== today) out.push({ title: "¿Qué te ha dicho Dios hoy?", body: NUDGES[i].body, tag: "nudge" });
      n.sent = true;
      changed = true;
    });
    for (const r of rec.reminders || []) {
      if (!r.sent && now >= r.at) {
        if (now - r.at < 3 * HOUR && rec.intention) out.push({ title: "Tu intención de hoy", body: rec.intention, tag: "r" + r.at });
        r.sent = true;
        changed = true;
      }
    }
    if (rec.reminders) rec.reminders = rec.reminders.filter((r) => !r.sent || now - r.at < 24 * HOUR);

    for (const n of out) {
      try {
        await push.sendNotification(rec.subscription, JSON.stringify(n), { TTL: 3600, urgency: "high" });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { await store.delete(key); return; }
        console.error("push error", e.statusCode, e.body);
      }
    }
    if (changed) await store.setJSON(key, rec);
  });

  await Promise.allSettled(work);
};

export const config = { schedule: "*/5 * * * *" };

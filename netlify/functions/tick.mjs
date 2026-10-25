import { subs, getSender, rand, localToday, dayKey } from "../lib/core.mjs";

const HOUR = 60 * 60 * 1000;

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
      out.push({ title: "Recordar hoy", body: "🌅 ¿Qué quieres recordar hoy?", tag: "morning" });
      rec.morningSent = true;
      changed = true;
    }
    for (const r of rec.reminders || []) {
      if (!r.sent && now >= r.at) {
        if (now - r.at < 3 * HOUR && rec.intention) out.push({ title: "Recordar hoy ✨", body: rec.intention, tag: "r" + r.at });
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

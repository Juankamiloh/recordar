import { subs, getVapid, idFor, validTz, rand, localToday, dayKey, json } from "../lib/core.mjs";

const MIN = 60 * 1000;

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\/?/, "");
  try {
    if (req.method === "GET" && route === "vapid") {
      return json({ publicKey: (await getVapid()).publicKey });
    }
    if (req.method !== "POST") return json({ error: "not_found" }, 404);
    const body = await req.json().catch(() => ({}));
    const store = subs();

    if (route === "subscribe") {
      const sub = body.subscription;
      if (!sub || typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
        return json({ error: "bad_subscription" }, 400);
      }
      const id = idFor(sub.endpoint);
      if (typeof body.id === "string" && /^[a-f0-9]{24}$/.test(body.id) && body.id !== id) {
        const old = await store.get(body.id, { type: "json" });
        await store.delete(body.id);
        if (old) delete old.subscription;
        body._carry = old;
      }
      const prev = (await store.get(id, { type: "json" })) || body._carry || {};
      const tz = validTz(body.tz) ? body.tz : prev.tz || "UTC";
      const rec = { ...prev, subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, tz, updated: Date.now() };
      await store.setJSON(id, rec);
      return json({ id });
    }

    if (route === "intention") {
      if (typeof body.id !== "string" || !/^[a-f0-9]{24}$/.test(body.id)) return json({ error: "bad_id" }, 400);
      const rec = await store.get(body.id, { type: "json" });
      if (!rec) return json({ error: "not_subscribed" }, 404);
      const intention = String(body.intention || "").trim().slice(0, 200);
      if (!intention) return json({ error: "empty" }, 400);
      if (validTz(body.tz)) rec.tz = body.tz;
      const tz = rec.tz || "UTC";
      const now = Date.now();
      const start = now + 20 * MIN;
      const end = localToday(tz, now, 21, 30);
      // Cada persona elige cuántas veces al día (1 a 8); si no dice, 4.
      const perDay = Number.isInteger(body.perDay) && body.perDay >= 1 && body.perDay <= 8 ? body.perDay : 4;
      let times = [];
      if (end - start >= 30 * MIN) {
        // Momentos al azar, repartidos para que no queden pegados
        const slot = (end - start) / perDay;
        for (let i = 0; i < perDay; i++) times.push(rand(start + i * slot, start + (i + 1) * slot - MIN));
      }
      rec.intention = intention;
      rec.intentionDay = dayKey(tz, now);
      rec.reminders = times.map((at) => ({ at, sent: false }));
      await store.setJSON(body.id, rec);
      return json({ count: times.length });
    }

    if (route === "unsubscribe") {
      if (typeof body.id === "string" && /^[a-f0-9]{24}$/.test(body.id)) await store.delete(body.id);
      return json({ ok: true });
    }

    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
};

export const config = { path: "/api/*" };

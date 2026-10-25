import webpush from "web-push";
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

export const subs = () => getStore({ name: "subs", consistency: "strong" });
const config = () => getStore({ name: "config", consistency: "strong" });

// Las llaves de notificación se crean solas la primera vez y quedan guardadas.
export async function getVapid() {
  const s = config();
  let v = await s.get("vapid", { type: "json" });
  if (!v) {
    const k = webpush.generateVAPIDKeys();
    try { await s.setJSON("vapid", k, { onlyIfNew: true }); } catch { await s.setJSON("vapid", k); }
    v = (await s.get("vapid", { type: "json" })) || k;
  }
  return v;
}

export async function getSender() {
  const v = await getVapid();
  const site = process.env.URL && process.env.URL.startsWith("https://") ? process.env.URL : "mailto:recordarhoy@example.com";
  webpush.setVapidDetails(site, v.publicKey, v.privateKey);
  return webpush;
}

export const idFor = (endpoint) => createHash("sha256").update(endpoint).digest("hex").slice(0, 24);
export const rand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

export function validTz(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

function parts(tz, date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const x of f.formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

export function dayKey(tz, ms) {
  const p = parts(tz, new Date(ms));
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

// Hora local (en la zona de la persona) de hoy → milisegundos UTC
export function localToday(tz, nowMs, h, mi) {
  const p = parts(tz, new Date(nowMs));
  const guess = Date.UTC(p.y, p.m - 1, p.d, h, mi);
  const q = parts(tz, new Date(guess));
  const offset = Date.UTC(q.y, q.m - 1, q.d, q.h, q.mi, q.s) - guess;
  return guess - offset;
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

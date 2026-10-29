// Shared data for the Class Assignments board.
// Stores classes and assignments in Upstash Redis (added from Vercel's Storage tab).
import { createHash, randomUUID } from "node:crypto";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const MAX_CLASSES = 60;
const MAX_ASSIGNMENTS = 800;
const COLORS = ["blue", "green", "orange", "purple", "pink", "yellow", "red", "brown", "gray"];

async function redis(...cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `Redis error ${r.status}`);
  return j.result;
}

const hash = (s) => createHash("sha256").update(String(s)).digest("hex");
const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function parseHash(arr) {
  const out = [];
  for (let i = 0; i < (arr || []).length; i += 2) {
    try { out.push(JSON.parse(arr[i + 1])); } catch {}
  }
  return out;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) {
    return res.status(503).json({ error: "The board has no database yet. In Vercel, open Storage and connect an Upstash Redis database, then redeploy." });
  }

  const ownerKey = req.headers["x-owner-key"] || "";
  const me = ownerKey ? hash(ownerKey) : null;
  const isAdmin = !!ADMIN_KEY && req.headers["x-admin-key"] === ADMIN_KEY;

  try {
    if (req.method === "GET") {
      const [c, a] = await Promise.all([redis("HGETALL", "classes"), redis("HGETALL", "assignments")]);
      const strip = ({ owner, ...rest }) => ({ ...rest, mine: !!me && owner === me });
      return res.status(200).json({
        classes: parseHash(c).sort((x, y) => x.createdAt.localeCompare(y.createdAt)).map(strip),
        assignments: parseHash(a).map(strip),
        admin: isAdmin,
      });
    }

    if (req.method === "POST") {
      if (!me) return res.status(400).json({ error: "Missing browser key. Reload the page and try again." });
      const body = await readBody(req);

      if (body.type === "class") {
        const name = clean(body.name, 40);
        if (!name) return res.status(400).json({ error: "Type a class name." });
        const existing = parseHash(await redis("HGETALL", "classes"));
        if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase()))
          return res.status(409).json({ error: "That class is already on the board." });
        if (existing.length >= MAX_CLASSES) return res.status(400).json({ error: "The board has too many classes. Remove an old one first." });
        const item = { id: randomUUID(), name, color: COLORS[existing.length % COLORS.length], owner: me, createdAt: new Date().toISOString() };
        await redis("HSET", "classes", item.id, JSON.stringify(item));
        return res.status(201).json({ ok: true });
      }

      if (body.type === "assignment") {
        const title = clean(body.title, 140);
        const cls = clean(body.cls, 40);
        const due = String(body.due || "");
        if (!title) return res.status(400).json({ error: "Add an assignment name." });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return res.status(400).json({ error: "Pick a due date." });
        const classes = parseHash(await redis("HGETALL", "classes"));
        if (!classes.some((c) => c.name.toLowerCase() === cls.toLowerCase()))
          return res.status(400).json({ error: "That class isn't on the board anymore." });
        if ((await redis("HLEN", "assignments")) >= MAX_ASSIGNMENTS)
          return res.status(400).json({ error: "The board is full. Remove some old assignments first." });
        const item = { id: randomUUID(), cls, title, due, owner: me, createdAt: new Date().toISOString() };
        await redis("HSET", "assignments", item.id, JSON.stringify(item));
        return res.status(201).json({ ok: true });
      }
      return res.status(400).json({ error: "Unknown request." });
    }

    if (req.method === "DELETE") {
      const type = req.query?.type ?? new URL(req.url, "http://x").searchParams.get("type");
      const id = req.query?.id ?? new URL(req.url, "http://x").searchParams.get("id");
      const key = type === "class" ? "classes" : type === "assignment" ? "assignments" : null;
      if (!key || !id) return res.status(400).json({ error: "Unknown request." });
      const raw = await redis("HGET", key, String(id));
      if (!raw) return res.status(200).json({ ok: true });
      const item = JSON.parse(raw);
      if (!isAdmin && item.owner !== me) return res.status(403).json({ error: "You can only remove things you added." });
      if (key === "classes" && !isAdmin) {
        const used = parseHash(await redis("HGETALL", "assignments")).some((a) => a.cls.toLowerCase() === item.name.toLowerCase());
        if (used) return res.status(400).json({ error: "Remove the assignments in this class first." });
      }
      await redis("HDEL", key, String(id));
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    return res.status(500).json({ error: "Something went wrong saving to the board. Try again." });
  }
}

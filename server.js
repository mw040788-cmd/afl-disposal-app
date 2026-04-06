const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Tesseract = require("tesseract.js");

const app = express();
const PORT = process.env.PORT;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 12 * 1024 * 1024 }
});

const TEAM_DB = {
  "brisbane": { style: "fast", possession: 1, allows: "neutral" },
  "collingwood": { style: "fast", possession: 1, allows: "allows-defenders" },
  "western bulldogs": { style: "fast", possession: 2, allows: "allows-defenders" },
  "essendon": { style: "mixed", possession: 0, allows: "allows-mids" },
  "carlton": { style: "slow", possession: 0, allows: "restrictive" },
  "melbourne": { style: "slow", possession: 0, allows: "restrictive" },
  "fremantle": { style: "slow", possession: 0, allows: "restrictive" },
  "st kilda": { style: "slow", possession: 0, allows: "restrictive" },
  "sydney": { style: "fast", possession: 1, allows: "neutral" },
  "west coast": { style: "mixed", possession: -1, allows: "allows-mids" },
  "gold coast": { style: "mixed", possession: 1, allows: "allows-mids" },
  "port adelaide": { style: "mixed", possession: 1, allows: "neutral" },
  "north melbourne": { style: "mixed", possession: -1, allows: "allows-defenders" },
  "gws": { style: "mixed", possession: 1, allows: "neutral" },
  "hawthorn": { style: "fast", possession: 1, allows: "neutral" },
  "richmond": { style: "slow", possession: -1, allows: "neutral" },
  "geelong": { style: "mixed", possession: 1, allows: "neutral" },
  "adelaide": { style: "mixed", possession: 1, allows: "neutral" }
};

const ROLE_HINTS = [
  {
    names: [
      "nick daicos", "josh daicos", "christian salem", "callum mills",
      "john noble", "ed richards", "justin mcinerney", "jack sinclair",
      "dayne zorko", "harry sheezel", "bailey smith", "max holmes"
    ],
    role: "outside",
    comp: "low",
    blowout: "good"
  },
  {
    names: [
      "marcus bontempelli", "lachie neale", "patrick cripps", "george hewett",
      "touk miller", "zach merrett", "josh dunkley", "tim kelly",
      "harley reid", "andrew brayshaw", "caleb serong", "jack steele",
      "noah anderson", "matthew kennedy", "jai newcombe", "james sicily"
    ],
    role: "inside",
    comp: "high",
    blowout: "mixed"
  },
  {
    names: ["kysaiah pickett", "joel freijah", "archie roberts", "tanner bruhn"],
    role: "hybrid",
    comp: "medium",
    blowout: "mixed"
  },
  {
    names: ["will ashcroft", "ryley sanders", "jason horne-francis", "finn callaghan", "luke davies-uniacke"],
    role: "mid-hybrid",
    comp: "high",
    blowout: "mixed"
  }
];

function key(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function titleCase(s) {
  return (s || "").replace(/\b\w/g, c => c.toUpperCase());
}

function roleGuess(name) {
  const n = key(name);
  for (const hint of ROLE_HINTS) {
    if (hint.names.some(x => n.includes(x))) {
      return { role: hint.role, comp: hint.comp, blowout: hint.blowout };
    }
  }
  return { role: "inside", comp: "medium", blowout: "mixed" };
}

function autoGuessFromText(text) {
  const t = key(text);
  const teams = Object.keys(TEAM_DB).filter(team => t.includes(team));
  let matchup = "";
  let venue = "";

  if (teams.length >= 2) {
    matchup = `${titleCase(teams[0])} vs ${titleCase(teams[1])}`;
  }

  if (t.includes("marvel")) venue = "Marvel Stadium";
  else if (t.includes("gabba")) venue = "The Gabba";
  else if (t.includes("optus")) venue = "Optus Stadium";
  else if (t.includes("mcg")) venue = "MCG";

  return { matchup, venue };
}

function normalizeText(text) {
  return (text || "")
    .replace(/Player Disposals Over\/Under/gi, "\n")
    .replace(/Last 5:/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ");
}

function isLikelyName(name) {
  if (!name) return false;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every(p => /^[A-Z][A-Za-z'.-]+$/.test(p));
}

function extractCandidates(text) {
  const raw = normalizeText(text);
  const lines = raw.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const candidates = [];

  for (const line of lines) {
    let m = line.match(/^([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3})\s+(\d{2}\.\d)\b/);
    if (m && isLikelyName(m[1])) {
      candidates.push({ source: "line-start", name: m[1].trim(), line: parseFloat(m[2]) });
    }

    m = line.match(/^([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3}).*?\b(\d{2}\.\d)\b/);
    if (m && isLikelyName(m[1])) {
      candidates.push({ source: "line-loose", name: m[1].trim(), line: parseFloat(m[2]) });
    }
  }

  const patterns = [
    /([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3})\s+(\d{2}\.\d)\b/g,
    /([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3})[\s\S]{0,14}?(\d{2}\.\d)\b/g,
    /([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3})[\s\S]{0,30}?Player Disposals Over\/Under[\s\S]{0,22}?(\d{2}\.\d)\b/gi
  ];

  for (const regex of patterns) {
    let m;
    while ((m = regex.exec(text || "")) !== null) {
      if (isLikelyName(m[1])) {
        candidates.push({ source: "global", name: m[1].trim(), line: parseFloat(m[2]) });
      }
    }
  }

  const freq = new Map();
  for (const c of candidates) {
    const id = `${key(c.name)}|${c.line}`;
    freq.set(id, (freq.get(id) || 0) + 1);
  }

  const dedup = [];
  const seen = new Set();

  for (const c of candidates) {
    const id = `${key(c.name)}|${c.line}`;
    if (!seen.has(id)) {
      seen.add(id);
      dedup.push({ ...c, hits: freq.get(id) || 1 });
    }
  }

  dedup.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits;
    return a.name.localeCompare(b.name);
  });

  return dedup;
}

function parsePlayersFromText(text) {
  return extractCandidates(text).slice(0, 5).map(item => ({
    name: item.name,
    line: item.line,
    recentHits: 2,
    recentMisses: 3,
    prevMatchup: 0,
    venueHist: 0,
    tagRisk: 0,
    subRisk: 0,
    ...roleGuess(item.name)
  }));
}

function venueImpact(venue, roof, role) {
  const v = key(venue);
  let score = 0;

  if (v.includes("marvel")) score += role === "outside" ? 2 : 1;
  if (v.includes("mcg")) score += role === "outside" ? 1 : 0;
  if (v.includes("optus")) score += role === "inside" ? 1 : 0;
  if (v.includes("gabba")) score += role === "outside" ? 1 : 0;
  if (roof === "closed") score += role === "outside" ? 1 : 0;
  if (roof === "open" && role === "outside") score -= 0.5;

  return score;
}

function weatherImpact(weather, role) {
  if (weather === "dry") return role === "outside" ? 1 : 0;
  if (weather === "wet") return role === "outside" ? -2 : -1;
  if (weather === "windy") return role === "outside" ? -1 : 0;
  return 0;
}

function scriptImpact(script, role, blowout) {
  if (script === "fast") return role === "outside" ? 2 : 1;
  if (script === "slow") return role === "inside" ? -1 : -2;

  if (script === "blowout") {
    if (blowout === "good") return 2;
    if (blowout === "mixed") return 0;
    return -1;
  }

  return 0;
}

function opponentImpact(opp, role) {
  if (opp === "allows-defenders") return role === "outside" ? 2 : 0;
  if (opp === "allows-mids") return role === "inside" || role === "mid-hybrid" ? 2 : 0;
  if (opp === "restrictive") return role === "outside" ? -1 : -2;
  return 0;
}

function autoScript(matchup, manual) {
  if (manual && manual !== "auto") return manual;

  const m = key(matchup);
  const teams = Object.keys(TEAM_DB).filter(t => m.includes(t));

  if (teams.length >= 2) {
    const a = TEAM_DB[teams[0]];
    const b = TEAM_DB[teams[1]];

    if (a.style === "fast" && b.style === "fast") return "fast";
    if (a.style === "slow" && b.style === "slow") return "slow";
    if (Math.abs((a.possession || 0) - (b.possession || 0)) >= 2) return "blowout";
  }

  return "mixed";
}

function autoOpponent(matchup, manual) {
  if (manual && manual !== "auto") return manual;

  const m = key(matchup);
  const teams = Object.keys(TEAM_DB).filter(t => m.includes(t));

  if (teams.length >= 2) return TEAM_DB[teams[1]].allows || "neutral";
  return "neutral";
}

function classifyConfidence(absScore) {
  if (absScore >= 8) return "High";
  if (absScore >= 5) return "Medium";
  return "Low";
}

function scorePlayers(payload) {
  const venue = payload.venue || "";
  const roof = payload.roof || "na";
  const weather = payload.weather || "dry";
  const script = autoScript(payload.matchup || "", payload.script);
  const opp = autoOpponent(payload.matchup || "", payload.opponentStyle);

  const results = (payload.players || []).map(p => {
    const lineHardness = p.line >= 30.5 ? -2 : p.line >= 27.5 ? -1 : p.line <= 22.5 ? 1 : 0;
    const recent = Number(p.recentHits || 0) - Number(p.recentMisses || 0);
    const roleScore = p.role === "outside" ? 1.5 : p.role === "mid-hybrid" ? 0.5 : p.role === "hybrid" ? 0 : -0.5;
    const compScore = p.comp === "high" ? -2 : p.comp === "medium" ? -1 : 1;

    const total =
      lineHardness +
      recent +
      roleScore +
      compScore +
      venueImpact(venue, roof, p.role) +
      weatherImpact(weather, p.role) +
      scriptImpact(script, p.role, p.blowout) +
      opponentImpact(opp, p.role) +
      Number(p.prevMatchup || 0) +
      Number(p.venueHist || 0) -
      Number(p.tagRisk || 0) -
      Number(p.subRisk || 0);

    return {
      ...p,
      total,
      decision: total >= 1 ? "MORE" : "LESS",
      confidence: classifyConfidence(Math.abs(total))
    };
  }).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const best = results[0] || null;
  const cut = results.length ? results.reduce((a, b) => Math.abs(a.total) < Math.abs(b.total) ? a : b) : null;

  return { script, opponentStyle: opp, best, cut, results };
}

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/api/parse-text", (req, res) => {
  const text = req.body?.text || "";
  const guessed = autoGuessFromText(text);
  const candidates = extractCandidates(text);
  const players = parsePlayersFromText(text);

  res.json({
    ok: true,
    rawText: text,
    guessed,
    candidates,
    players
  });
});

app.post("/api/score", (req, res) => {
  res.json({
    ok: true,
    ...scorePlayers(req.body || {})
  });
});

app.post("/api/parse-screenshot", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "No file uploaded." });
  }

  try {
    const result = await Tesseract.recognize(req.file.path, "eng");
    const text = result.data?.text || "";
    const guessed = autoGuessFromText(text);
    const candidates = extractCandidates(text);
    const players = parsePlayersFromText(text);

    fs.unlink(req.file.path, () => {});

    res.json({
      ok: true,
      rawText: text,
      guessed,
      candidates,
      players
    });
  } catch (err) {
    fs.unlink(req.file.path, () => {});

    res.status(500).json({
      ok: false,
      error: "OCR failed.",
      detail: String(err)
    });
  }
});

app.listen(PORT, () => {
  console.log(`AFL V7 starter running on port ${PORT}`);
});

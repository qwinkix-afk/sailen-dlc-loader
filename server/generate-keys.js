import { createHmac, randomBytes } from "node:crypto";

const SECRET = "sailendlc_super_secret_2026";

function hmac(data) {
  return createHmac("sha256", SECRET).update(data).digest("hex").substring(0, 12).toUpperCase();
}

function generateKey(type, maxUses) {
  const rand = randomBytes(6).toString("hex").toUpperCase();
  const payload = type + maxUses + rand;
  const sig = hmac(payload);
  return `SLDLC-${type}-${maxUses}-${rand}-${sig}`;
}

const keysToMake = [
  { type: "P",  label: "Permanent (навсегда)", count: 3, uses: 1 },
  { type: "P",  label: "Permanent x2",         count: 2, uses: 2 },
  { type: "30", label: "30 дней x1",           count: 3, uses: 1 },
  { type: "30", label: "30 дней x2",           count: 2, uses: 2 },
  { type: "7",  label: "7 дней x1",            count: 3, uses: 1 },
  { type: "90", label: "90 дней x1",           count: 3, uses: 1 },
];

console.log("=== Генератор ключей SailenDLC ===\n");
console.log(`SECRET: ${SECRET}\n`);

for (const k of keysToMake) {
  console.log(`--- ${k.label} ---`);
  for (let i = 0; i < k.count; i++) {
    console.log(generateKey(k.type, k.uses));
  }
  console.log("");
}

// Verify
function verifyKey(code) {
  const parts = code.split("-");
  if (parts.length !== 5 || parts[0] !== "SLDLC") return null;
  const type = parts[1];
  const maxUses = parseInt(parts[2], 10);
  const rand = parts[3];
  const sig = parts[4];
  const expected = hmac(type + maxUses + rand);
  if (sig !== expected) return null;

  let days = 0;
  if (type === "P") days = Infinity;
  else days = parseInt(type, 10);
  if (!days) return null;

  return { type, days, maxUses };
}

const test = generateKey("30", 2);
console.log(`Test key: ${test}`);
console.log(`Verify: ${JSON.stringify(verifyKey(test))}`);

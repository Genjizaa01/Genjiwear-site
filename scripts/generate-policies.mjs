// scripts/generate-policies.mjs
import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

const ROOT = process.cwd();

const readJSON = async (p) =>
  JSON.parse(await fs.readFile(path.join(ROOT, p), "utf8"));

const cfg = await readJSON("policy-config.json");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- HTML shell (โทนสีครีมให้เข้ากับเว็บ) ----
const htmlShell = (title, body) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} · ${cfg.brand_name}</title>
  <meta name="description" content="${title} for ${cfg.brand_name}" />
  <link rel="canonical" href="${cfg.store_url}${title.toLowerCase().replace(/\s+/g,'-')}.html">
  <style>
    :root{--bg:${cfg.ui.theme_bg};--fg:${cfg.ui.theme_fg};--link:#0a66c2}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    header,main,footer{max-width:920px;margin:0 auto;padding:24px}
    header a{color:var(--link);text-decoration:none;margin-right:12px}
    h1{font-size:28px;margin:8px 0 16px}
    h2{margin:24px 0 8px;font-size:20px}
    p,li{max-width:80ch}
    .muted{opacity:.7;font-size:14px}
    .card{background:#fff;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.08);padding:20px}
    a{color:var(--link)}
  </style>
</head>
<body>
  <header>
    <nav>
      <a href="${cfg.ui.base_path}/">Home</a>
      <a href="${cfg.ui.base_path}/privacy.html">Privacy</a>
      <a href="${cfg.ui.base_path}/terms.html">Terms</a>
      <a href="${cfg.ui.base_path}/returns.html">Returns</a>
    </nav>
  </header>
  <main class="card">
    <h1>${title}</h1>
    ${body}
    <p class="muted">Last updated: ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
  </main>
  <footer>
    <p class="muted">© ${new Date().getFullYear()} ${cfg.brand_name}. All rights reserved.</p>
  </footer>
</body>
</html>`;

// ---- คำสั่ง (instructions) ระดับ “ทนายอีคอมเมิร์ซ” สำหรับ AI ----
const baseInstructions = `
You are a senior e-commerce counsel & copywriter.
Write clear, enforceable, consumer-friendly policy content in US English
for a modern streetwear brand.

BRAND FACTS:
- Brand: ${cfg.brand_name}
- Entity type: ${cfg.business_entity_type}
- Jurisdiction & governing law: ${cfg.legal.governing_law}
- Contact: ${cfg.contact_email}
- Store URL: ${cfg.store_url}
- Print-on-demand: ${cfg.returns.pod_made_to_order ? "Yes (made to order)" : "No"}
- Returns window (physical goods): ${cfg.returns.window_days} days
- Size exchange allowed: ${cfg.returns.allow_size_exchange ? "Yes" : "No"}
- Buyer pays return shipping if not defective: ${cfg.returns.buyer_pays_return_shipping_if_not_defective ? "Yes" : "No"}
- Digital goods refundable?: ${cfg.digital_goods.refundable ? "Yes" : "No"}; Exceptions: ${cfg.digital_goods.exceptions}

STYLE:
- Plain language, short paragraphs, logical headings.
- Include bullet points where helpful.
- Avoid legalese unless necessary; keep it enforceable.
- Include “This is not legal advice” disclaimer.

COMPLIANCE HINTS:
- Privacy: data we collect; cookies/analytics; lawful bases; CPRA/California rights summary; opt-out/how to contact; data retention; security; minors; international transfers.
- Terms: eligibility; licensing & IP; user conduct; pricing & taxes; shipping & risk of loss; made-to-order items; digital license terms; warranties/disclaimers; limitation of liability; indemnity; governing law; arbitration (if configured); updates to terms.
- Returns: eligibility; made-to-order constraints; defects vs. remorse; size exchange rules; process & timelines; condition of returned items; digital goods policy; abuse & fraud.
`;

// ---- คำสั่งเฉพาะหน้า ----
const directives = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    ask: `Produce a complete PRIVACY POLICY in valid semantic HTML (<section>, <h2>, <p>, <ul>, etc.). 
    Include a CPRA (California) rights summary and cookie section. Provide a clear contact & opt-out process.`
  },
  {
    slug: "terms",
    title: "Terms of Service",
    ask: `Produce full TERMS OF SERVICE in valid HTML. Cover eligibility, orders, pricing/taxes, shipping, made-to-order items, 
    digital license, prohibited uses, warranties, limitation of liability, indemnity, governing law (${cfg.legal.governing_law}), 
    and a simple arbitration clause (if enabled: ${cfg.legal.arbitration}).`
  },
  {
    slug: "returns",
    title: "Return & Refund Policy",
    ask: `Produce a RETURN & REFUND POLICY in valid HTML. Emphasize made-to-order constraints, 
    ${cfg.returns.window_days}-day return window for physical goods, size exchange rules, 
    digital goods (${cfg.digital_goods.refundable ? "refundable" : "non-refundable"}) with exceptions, 
    and a step-by-step return process with timelines.`
  }
];

async function generateOne({ slug, title, ask }) {
  const res = await client.responses.create({
    model: "gpt-4o",
    instructions: baseInstructions,
    input: ask
  });
  const htmlBody = res.output_text;
  const out = htmlShell(title, htmlBody);
  await fs.writeFile(path.join(ROOT, `${slug}.html`), out, "utf8");
  console.log(`✓ wrote ${slug}.html`);
}

async function ensureNavLinks() {
  // แทรกลิงก์ใน index.html ถ้ายังไม่มี
  const idxPath = path.join(ROOT, "index.html");
  try {
    let html = await fs.readFile(idxPath, "utf8");
    const hasPrivacy = html.includes("privacy.html");
    if (!hasPrivacy) {
      // พยายามแทรกก่อน </nav>, ถ้าไม่เจอก็เติมไว้ท้าย <header>
      if (html.includes("</nav>")) {
        html = html.replace(
          "</nav>",
          `  <a href="${cfg.ui.base_path}/privacy.html">Privacy</a>
  <a href="${cfg.ui.base_path}/terms.html">Terms</a>
  <a href="${cfg.ui.base_path}/returns.html">Returns</a>
</nav>`
        );
      } else if (html.includes("</header>")) {
        html = html.replace(
          "</header>",
          `<nav style="margin-top:8px">
  <a href="${cfg.ui.base_path}/privacy.html">Privacy</a>
  <a href="${cfg.ui.base_path}/terms.html">Terms</a>
  <a href="${cfg.ui.base_path}/returns.html">Returns</a>
</nav>
</header>`
        );
      } else {
        html += `\n<footer style="padding:16px;text-align:center">
  <a href="${cfg.ui.base_path}/privacy.html">Privacy</a> · 
  <a href="${cfg.ui.base_path}/terms.html">Terms</a> · 
  <a href="${cfg.ui.base_path}/returns.html">Returns</a>
</footer>\n`;
      }
      await fs.writeFile(idxPath, html, "utf8");
      console.log("✓ updated index.html with policy links");
    } else {
      console.log("• index.html already has policy links");
    }
  } catch {
    console.log("! index.html not found; skipped nav update");
  }
}

for (const d of directives) await generateOne(d);
await ensureNavLinks();
console.log("All policy pages generated.");

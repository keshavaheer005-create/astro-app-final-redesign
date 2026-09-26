/* Scratch QA script — renders the actual icon components to static HTML.
   Deleted after use; not part of the app. */
import { renderToStaticMarkup } from "react-dom/server";
import { Icon, LogoMark, AcharyaAvatar } from "./src/components/selfsage/icons";

const names = [
  "home", "chart", "journal", "chat", "user", "bell", "sun", "moon", "planet",
  "star", "sparkle", "flame", "calendar", "clock", "pin", "search", "crosshair",
  "settings", "globe", "sunrise", "sunset", "heart", "trending-up", "shield",
  "warning", "info", "check", "x", "chevron-right", "chevron-down",
  "arrow-left", "arrow-right", "send", "plus", "edit", "lotus", "om",
  "compass", "list", "download", "refresh",
] as const;

const cells = names
  .map(
    (n) =>
      `<div class="cell"><div class="ic">${renderToStaticMarkup(
        <Icon name={n} size={28} />,
      )}</div><span>${n}</span></div>`,
  )
  .join("\n");

const svg = (el: React.ReactElement, label: string) =>
  `<div class="cell tall"><div class="ic">${renderToStaticMarkup(el)}</div><span>${label}</span></div>`;

const marks = [
  svg(<LogoMark size={80} />, "LogoMark 80"),
  svg(<LogoMark size={40} />, "LogoMark 40"),
  svg(<LogoMark size={24} />, "LogoMark 24"),
  svg(<AcharyaAvatar size={80} />, "Acharya 80"),
  svg(<AcharyaAvatar size={40} />, "Acharya 40"),
  svg(<AcharyaAvatar size={28} />, "Acharya 28"),
].join("\n");

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { background:#FAF7F0; font-family: system-ui; padding:24px; color:#1A1A1A; }
  h1 { font-size:16px } h2 { font-size:13px; margin:24px 0 8px; color:#6B5E4E }
  .grid { display:grid; grid-template-columns:repeat(14, 92px); gap:10px }
  .row { display:flex; gap:16px; align-items:flex-end }
  .cell { display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 4px; border:1px solid rgba(201,162,39,.25); border-radius:10px; background:rgba(255,255,255,.6) }
  .cell span { font-size:9px; color:#6B5E4E; word-break:break-all; text-align:center }
  .ic { color:#2A2420; display:grid; place-items:center; min-height:34px }
  .tall .ic { min-height:88px }
  .ink { background:#2A2420 !important; }
  .ink .ic { color:#E8C568 }
</style></head><body>
<h1>Self Sage icon QA render</h1>
<h2>Line icons (28px, charcoal on cream)</h2>
<div class="grid">${cells}</div>
<h2>Marks</h2>
<div class="row">${marks}</div>
<h2>Glyph on ink (avatar stroke visibility)</h2>
<div class="row">
  ${svg(<AcharyaAvatar size={80} />, "ink 80")}
</div>
</body></html>`;

await Bun.write("/tmp/ss-icons.html", html);
console.log("written /tmp/ss-icons.html");

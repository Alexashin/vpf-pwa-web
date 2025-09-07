// tools/pull-schedule.js

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

const SOURCE_URL = 'https://project13487951.tilda.ws/page74408851.html';
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/vpf-pwa-web/data');
const OUT_FILE = path.join(OUT_DIR, 'schedule-raw.html');

function abs(u, base) { try { return new URL(u, base).href; } catch { return u; } }

async function run() {
    const html = await fetch(SOURCE_URL).then(r => r.text());
    const $ = load(html, { decodeEntities: false });

    const $t521 = $('.t521').first();
    if (!$t521.length) throw new Error('Не найден блок .t521 на исходной странице');

    // Собираем нужные CSS из <head>
    const cssHrefs = [];
    $('link[rel="stylesheet"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (/tilda-(grid|blocks|animation|cover).*\.css/i.test(href)) cssHrefs.push(abs(href, SOURCE_URL));
        if (/fonts-tilda.*\.css/i.test(href)) cssHrefs.push(abs(href, SOURCE_URL));
    });

    // Абсолютные пути внутри фрагмента
    $t521.find('[src]').each((_, el) => {
        const v = $(el).attr('src'); if (v) $(el).attr('src', abs(v, SOURCE_URL));
    });
    $t521.find('[href]').each((_, el) => {
        const v = $(el).attr('href'); if (v) $(el).attr('href', abs(v, SOURCE_URL));
    });
    $t521.find('[style]').each((_, el) => {
        const st = $(el).attr('style');
        if (st) $(el).attr('style', st.replace(/url\((['"]?)([^'")]+)\1\)/ig, (_m, q, u) => `url(${abs(u, SOURCE_URL)})`));
    });

    const outHtml = `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${cssHrefs.map(h => `<link rel="stylesheet" href="${h}">`).join('\n')}
<style>
  .vpf-fav-btn{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .6rem;border:1px solid #14188f;border-radius:999px;font:600 14px/1 system-ui;color:#14188f;background:#fff;cursor:pointer}
  .vpf-fav-btn.is-on{color:#fff;background:#14188f}
  .vpf-fav-wrap{margin:8px 0 12px;display:flex;justify-content:flex-end}
  .vpf-hidden{display:none!important}
</style>
</head><body>
<div id="scheduleRoot">
${$t521.toString()}
</div>
</body></html>`;

    await fs.mkdir(OUT_DIR, { recursive: true });
    await fs.writeFile(OUT_FILE, outHtml, 'utf8');
    console.log('Saved:', OUT_FILE);
}

run().catch(e => { console.error(e); process.exit(1); });

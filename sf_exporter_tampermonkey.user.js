// ==UserScript==
// @name         SF Table Exporter
// @namespace    https://antonimagit.github.io/sf-exporter/
// @version      1.2
// @description  Esporta tabelle Salesforce con virtual scroll in CSV
// @author       Antonio
// @match        https://*.lightning.force.com/*
// @match        https://*.salesforce.com/*
// @grant        unsafeWindow
// @run-at       document-idle
// @updateURL    https://antonimagit.github.io/sf-exporter/sf_exporter_tampermonkey.user.js
// @downloadURL  https://antonimagit.github.io/sf-exporter/sf_exporter_tampermonkey.user.js
// ==/UserScript==

(function () {
  'use strict';

  const D = (typeof unsafeWindow !== 'undefined' && unsafeWindow.document) || document;

  function waitForPage() {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const hasTable = D.querySelector('.data-grid-table-ctr') || D.querySelector('[aria-rowcount]');
      if (hasTable) {
        clearInterval(interval);
        injectTriggerButton();
      }
      if (attempts > 120) clearInterval(interval);
    }, 500);
  }

  function injectTriggerButton() {
    if (D.getElementById('sfx-trigger')) return;
    const btn = D.createElement('button');
    btn.id = 'sfx-trigger';
    btn.textContent = '⬇ Export CSV';
    btn.style.cssText = `
      position: fixed; bottom: 28px; right: 28px; z-index: 999999;
      padding: 10px 18px;
      background: linear-gradient(135deg, #5c6bc0, #7c85ff);
      color: #fff; border: none; border-radius: 10px;
      font-family: 'SF Mono', monospace; font-size: 12px; font-weight: 700;
      letter-spacing: .08em; cursor: pointer;
      box-shadow: 0 4px 20px rgba(124,133,255,.4);
      transition: all .15s;
    `;
    btn.onmouseenter = () => { btn.style.filter = 'brightness(1.15)'; btn.style.transform = 'translateY(-2px)'; };
    btn.onmouseleave = () => { btn.style.filter = ''; btn.style.transform = ''; };
    btn.onclick = launchExporter;
    D.body.appendChild(btn);
  }

  function launchExporter() {
    if (D.getElementById('sf-exporter-ui')) return;

    const ui = D.createElement('div');
    ui.id = 'sf-exporter-ui';
    ui.innerHTML = `
      <style>
        #sf-exporter-ui {
          position: fixed; top: 24px; right: 24px; z-index: 999999;
          width: 310px;
          background: #0f1117;
          border: 1px solid #2a2d3a;
          border-radius: 12px;
          box-shadow: 0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset;
          font-family: 'SF Mono', 'Fira Code', monospace;
          color: #e2e8f0;
          overflow: hidden;
          user-select: none;
        }
        #sfx-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px 12px;
          border-bottom: 1px solid #1e2130;
          background: linear-gradient(135deg,#1a1d2e,#0f1117);
        }
        #sfx-title { font-size: 11px; font-weight: 700; letter-spacing: .12em; color: #7c85ff; text-transform: uppercase; }
        #sfx-close { cursor: pointer; color: #4a5068; font-size: 16px; line-height: 1; transition: color .15s; }
        #sfx-close:hover { color: #e2e8f0; }
        #sfx-body { padding: 16px; }
        #sfx-status { font-size: 12px; color: #8892b0; margin-bottom: 14px; min-height: 16px; letter-spacing: .02em; }
        #sfx-status span { color: #7c85ff; font-weight: 700; }
        #sfx-bar-wrap { background: #1a1d2e; border-radius: 4px; height: 6px; overflow: hidden; margin-bottom: 16px; }
        #sfx-bar {
          height: 100%; width: 0%;
          background: linear-gradient(90deg, #5c6bc0, #7c85ff);
          border-radius: 4px; transition: width .2s ease;
          box-shadow: 0 0 8px #7c85ff88;
        }
        #sfx-counters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .sfx-kpi { background: #1a1d2e; border-radius: 8px; padding: 10px 12px; border: 1px solid #2a2d3a; }
        .sfx-kpi-label { font-size: 9px; color: #4a5068; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 4px; }
        .sfx-kpi-value { font-size: 20px; font-weight: 700; color: #e2e8f0; letter-spacing: -.02em; }
        #sfx-btn {
          width: 100%; padding: 10px; border: none; border-radius: 8px; cursor: pointer;
          font-family: inherit; font-size: 11px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; transition: all .15s;
          background: linear-gradient(135deg,#5c6bc0,#7c85ff); color: #fff;
        }
        #sfx-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
        #sfx-btn:disabled { background: #2a2d3a; color: #4a5068; cursor: not-allowed; transform: none; }
        #sfx-log { margin-top: 12px; font-size: 10px; color: #4a5068; max-height: 60px; overflow-y: auto; line-height: 1.6; }
        .sfx-log-ok { color: #4ade80; }
        .sfx-log-err { color: #f87171; }
      </style>
      <div id="sfx-header">
        <div id="sfx-title">⬇ SF Table Exporter</div>
        <div id="sfx-close">✕</div>
      </div>
      <div id="sfx-body">
        <div id="sfx-status">Pronto. Clicca Start.</div>
        <div id="sfx-bar-wrap"><div id="sfx-bar"></div></div>
        <div id="sfx-counters">
          <div class="sfx-kpi"><div class="sfx-kpi-label">Raccolte</div><div class="sfx-kpi-value" id="sfx-collected">0</div></div>
          <div class="sfx-kpi"><div class="sfx-kpi-label">Totale</div><div class="sfx-kpi-value" id="sfx-total">—</div></div>
        </div>
        <button id="sfx-btn">▶ Start Export</button>
        <div id="sfx-log"></div>
      </div>
    `;
    D.body.appendChild(ui);

    const $ = id => D.getElementById(id);
    $('sfx-close').onclick = () => ui.remove();

    function log(msg, cls) {
      const el = $('sfx-log');
      el.innerHTML += `<div class="${cls || ''}">${msg}</div>`;
      el.scrollTop = el.scrollHeight;
    }

    function findScrollContainer() {
      const ctrs = [...D.querySelectorAll('.data-grid-table-ctr')];
      return ctrs.find(el => el.scrollHeight > el.clientHeight && el.clientHeight > 50) || null;
    }

    function getTotalRows() {
      const el = D.querySelector('[aria-rowcount]');
      return el ? parseInt(el.getAttribute('aria-rowcount')) : null;
    }

    function detectColumns() {
      const byAria = [];
      D.querySelectorAll('.data-grid-header-row .data-grid-header-cell [aria-label]').forEach(el => {
        const lbl = el.getAttribute('aria-label') || '';
        const match = lbl.match(/^Header (.+?) Tooltip/);
        if (match) byAria.push(match[1]);
      });
      if (byAria.length) return byAria;

      const byText = [];
      D.querySelectorAll('.data-grid-header-row .data-grid-header-cell').forEach(el => {
        const txt = el.innerText || el.textContent || '';
        const clean = txt.trim().split('\n')[0].trim();
        if (clean) byText.push(clean);
      });
      if (byText.length) return byText;

      return null;
    }

    function detectNumColsFromData(collected) {
      let max = 0;
      collected.forEach(cols => {
        Object.keys(cols).forEach(k => { if (parseInt(k) > max) max = parseInt(k); });
      });
      return max + 1;
    }

    function harvest(collected) {
      D.querySelectorAll('td[data-row-index]').forEach(cell => {
        const rowIdx = cell.getAttribute('data-row-index');
        const colIdx = parseInt(cell.getAttribute('data-column-index'));
        if (rowIdx === null || isNaN(colIdx)) return;
        if (!collected.has(rowIdx)) collected.set(rowIdx, {});
        const tip = cell.querySelector('[data-tooltip]');
        if (tip) collected.get(rowIdx)[colIdx] = tip.getAttribute('data-tooltip');
      });
    }

    function downloadCSV(collected, headers) {
      const numCols = headers ? headers.length : detectNumColsFromData(collected);
      const resolvedHeaders = headers || Array.from({ length: numCols }, (_, i) => `Col${i}`);
      const headerLine = resolvedHeaders.map(h => `"${h}"`).join(',');
      const rows = [...collected.entries()]
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([, cols]) =>
          Array.from({ length: numCols }, (_, i) =>
            `"${(cols[i] || '').replace(/"/g, '""')}"`
          ).join(',')
        );
      const csv = headerLine + '\n' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = D.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'salesforce_export_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
    }

    $('sfx-btn').onclick = async function () {
      const btn = this;
      btn.disabled = true;
      btn.textContent = '⏳ Elaborazione...';
      const delay = ms => new Promise(r => setTimeout(r, ms));

      const scrollContainer = findScrollContainer();
      if (!scrollContainer) {
        log('❌ Container non trovato. Sei sulla pagina giusta?', 'sfx-log-err');
        btn.disabled = false; btn.textContent = '▶ Start Export'; return;
      }

      const totalRows = getTotalRows();
      $('sfx-total').textContent = totalRows || '?';
      log(`Container trovato. Righe attese: ${totalRows}`, 'sfx-log-ok');

      const headers = detectColumns();
      log(`Colonne: ${headers ? headers.join(', ') : '(rilevate dai dati)'}`, '');

      const collected = new Map();
      const totalHeight = scrollContainer.scrollHeight;
      const step = 150;
      const iterations = Math.ceil(totalHeight / step) + 1;
      let i = 0;

      for (let pos = 0; pos <= totalHeight + step; pos += step) {
        scrollContainer.scrollTop = pos;
        await delay(300);
        harvest(collected);
        i++;
        const pct = Math.min(100, Math.round((i / iterations) * 100));
        $('sfx-bar').style.width = pct + '%';
        $('sfx-collected').textContent = collected.size;
        $('sfx-status').innerHTML = `Scroll <span>${pos}px</span> / ${totalHeight}px`;
      }

      scrollContainer.scrollTop = totalHeight;
      await delay(500);
      harvest(collected);
      $('sfx-collected').textContent = collected.size;
      $('sfx-bar').style.width = '100%';

      log(`✅ Raccolte ${collected.size} righe. Download in corso...`, 'sfx-log-ok');
      $('sfx-status').innerHTML = `Completato! <span>${collected.size}</span> righe esportate.`;
      downloadCSV(collected, headers);

      btn.textContent = '✅ Esportato!';
      setTimeout(() => { btn.disabled = false; btn.textContent = '▶ Riesporta'; }, 3000);
    };
  }

  waitForPage();

})();

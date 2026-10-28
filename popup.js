let tabId, entries = [], selectedId = null;
const $ = (s) => document.querySelector(s);

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const pretty = (s) => {
  if (s == null || s === "") return "(empty)";
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
};
const statusClass = (e) => (e.error || e.status >= 400 ? "err" : e.status >= 300 ? "warn" : "ok");

function toCurl(e) {
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const parts = [`curl ${q(e.url)}`];
  if (e.method !== "GET") parts.push(`-X ${e.method}`);
  for (const [k, v] of Object.entries(e.requestHeaders || {})) parts.push(`-H ${q(`${k}: ${v}`)}`);
  if (e.requestBody != null && e.requestBody !== "") parts.push(`--data-raw ${q(e.requestBody)}`);
  return parts.join(" \\\n  ");
}

const headersText = (h) => Object.entries(h || {}).map(([k, v]) => `${k}: ${v}`).join("\n") || "(none)";

function renderList() {
  const f = $("#filter").value.toLowerCase(), t = $("#type").value;
  const shown = entries.filter((e) =>
    (!t || e.type === t) && (!f || `${e.method} ${e.url} ${e.status}`.toLowerCase().includes(f)));
  $("#list").innerHTML = shown.slice().reverse().map((e) => `
    <li data-id="${e.id}" class="${e.id === selectedId ? "active" : ""}">
      <span class="m">${esc(e.method)}</span>
      <span class="s ${statusClass(e)}">${e.error && !e.status ? "ERR" : esc(e.status)}</span>
      <span class="u" title="${esc(e.url)}">${esc(e.url.replace(/^https?:\/\/[^/]+/, ""))}</span>
      <span class="t">${esc(e.type)}</span>
    </li>`).join("");
}

function section(title, body, copyId) {
  return `<h3>${title}${copyId ? `<button data-copy="${copyId}">Copy</button>` : ""}</h3><pre id="${copyId || ""}">${esc(body)}</pre>`;
}

function renderDetail() {
  const e = entries.find((x) => x.id === selectedId);
  const d = $("#detail");
  if (!e) { d.className = "empty"; d.textContent = "Select a request to see details"; return; }
  d.className = "";
  d.innerHTML = `
    <div class="url">${esc(e.method)} ${esc(e.url)}</div>
    <div>Status: <b class="${statusClass(e)}">${esc(e.status)} ${esc(e.statusText)}</b> · ${esc(e.duration)} ms · ${esc(e.type)} · ${new Date(e.time).toLocaleTimeString()}</div>
    ${e.error ? `<div class="err">Error: ${esc(e.error)}</div>` : ""}
    ${section("cURL", toCurl(e), "c-curl")}
    ${section("Request Body (sent)", pretty(e.requestBody), "c-reqb")}
    ${section("Response Body (received)", pretty(e.responseBody), "c-resb")}
    ${section("Request Headers", headersText(e.requestHeaders), "c-reqh")}
    ${section("Response Headers", headersText(e.responseHeaders), "c-resh")}
    <p class="t">Note: cookies and browser-managed headers aren't visible to page scripts, so they're not in the cURL.</p>`;
}

async function load() {
  const r = await chrome.storage.session.get(`tab_${tabId}`);
  entries = r[`tab_${tabId}`] || [];
  renderList();
  renderDetail();
}

document.addEventListener("click", async (ev) => {
  const li = ev.target.closest("#list li");
  if (li) { selectedId = li.dataset.id; renderList(); renderDetail(); return; }
  const copy = ev.target.dataset.copy;
  if (copy) {
    await navigator.clipboard.writeText($("#" + copy).textContent);
    ev.target.textContent = "Copied ✓";
    setTimeout(() => (ev.target.textContent = "Copy"), 1200);
  }
});

$("#filter").addEventListener("input", renderList);
$("#type").addEventListener("change", renderList);
$("#clear").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ kind: "apiLens:clear", tabId });
  selectedId = null;
  load();
});
$("#export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `api-lens-${Date.now()}.json`;
  a.click();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes[`tab_${tabId}`]) load();
});

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => { tabId = tab.id; load(); });

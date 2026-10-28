// Isolated world: relays captured entries from the page to the background worker.
window.addEventListener("message", (ev) => {
  if (ev.source !== window || !ev.data || !ev.data.__apiLens) return;
  try { chrome.runtime.sendMessage({ kind: "apiLens:entry", entry: ev.data.entry }); } catch {}
});

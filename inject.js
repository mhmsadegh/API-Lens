// Runs in the page's MAIN world: wraps fetch and XMLHttpRequest and reports each call.
(() => {
  if (window.__apiLensInstalled) return;
  window.__apiLensInstalled = true;

  const MAX_BODY = 200 * 1024;
  const clip = (s) => (typeof s === "string" && s.length > MAX_BODY ? s.slice(0, MAX_BODY) + "\n…[truncated]" : s);
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return String(u); } };

  const emit = (entry) => window.postMessage({ __apiLens: true, entry }, "*");

  function bodyToString(body) {
    if (body == null) return null;
    if (typeof body === "string") return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (body instanceof FormData) {
      const parts = [];
      for (const [k, v] of body.entries()) parts.push(`${k}=${v instanceof File ? `@${v.name}` : v}`);
      return parts.join("&");
    }
    if (body instanceof Blob) return `[Blob ${body.type || ""} ${body.size} bytes]`;
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      try { return new TextDecoder().decode(body); } catch { return "[binary]"; }
    }
    try { return JSON.stringify(body); } catch { return String(body); }
  }

  const headersToObj = (h) => {
    const o = {};
    try { new Headers(h || {}).forEach((v, k) => (o[k] = v)); } catch {}
    return o;
  };

  // ---- fetch ----
  const origFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    const start = performance.now();
    const isReq = input instanceof Request;
    const entry = {
      id: id(),
      type: "fetch",
      method: (init.method || (isReq ? input.method : "GET")).toUpperCase(),
      url: abs(isReq ? input.url : input),
      requestHeaders: headersToObj(init.headers || (isReq ? input.headers : undefined)),
      requestBody: null,
      time: Date.now(),
      page: location.href,
    };
    if (init.body !== undefined) entry.requestBody = clip(bodyToString(init.body));
    else if (isReq && entry.method !== "GET" && entry.method !== "HEAD") {
      try { entry.requestBody = clip(await input.clone().text()); } catch {}
    }

    try {
      const res = await origFetch.apply(this, arguments);
      entry.status = res.status;
      entry.statusText = res.statusText;
      entry.responseHeaders = headersToObj(res.headers);
      entry.duration = Math.round(performance.now() - start);
      res.clone().text()
        .then((t) => { entry.responseBody = clip(t); })
        .catch(() => { entry.responseBody = "[unreadable]"; })
        .finally(() => emit(entry));
      return res;
    } catch (err) {
      entry.error = String(err);
      entry.duration = Math.round(performance.now() - start);
      emit(entry);
      throw err;
    }
  };

  // ---- XHR ----
  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open, origSend = XHR.send, origSetHeader = XHR.setRequestHeader;

  XHR.open = function (method, url) {
    this.__apiLens = { id: id(), type: "xhr", method: String(method).toUpperCase(), url: abs(url), requestHeaders: {}, page: location.href };
    return origOpen.apply(this, arguments);
  };
  XHR.setRequestHeader = function (k, v) {
    if (this.__apiLens) this.__apiLens.requestHeaders[k] = v;
    return origSetHeader.apply(this, arguments);
  };
  XHR.send = function (body) {
    const e = this.__apiLens;
    if (e) {
      e.requestBody = clip(bodyToString(body));
      e.time = Date.now();
      const start = performance.now();
      this.addEventListener("loadend", () => {
        e.status = this.status;
        e.statusText = this.statusText;
        e.duration = Math.round(performance.now() - start);
        e.responseHeaders = {};
        (this.getAllResponseHeaders() || "").trim().split(/\r?\n/).forEach((line) => {
          const i = line.indexOf(":");
          if (i > 0) e.responseHeaders[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
        });
        try {
          const rt = this.responseType;
          if (rt === "" || rt === "text") e.responseBody = clip(this.responseText);
          else if (rt === "json") e.responseBody = clip(JSON.stringify(this.response));
          else e.responseBody = `[${rt} response]`;
        } catch { e.responseBody = "[unreadable]"; }
        if (this.status === 0) e.error = "Network error / aborted";
        emit(e);
      });
    }
    return origSend.apply(this, arguments);
  };
})();

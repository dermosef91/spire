// Small DOM + general helpers used across the UI layer.

export function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.id) node.id = opts.id;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.html != null) node.innerHTML = opts.html;
  if (opts.title) node.title = opts.title;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.on) for (const [evt, fn] of Object.entries(opts.on)) node.addEventListener(evt, fn);
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Replace {n} style tokens in a string
export function fmt(str, vals) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vals[k] != null ? vals[k] : `{${k}}`));
}

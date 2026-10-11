"use strict";
// The page starts once the C++ engine (securecore.wasm) has loaded.
if (typeof SecureCoreModule === "undefined") {
  document.querySelector("main").innerHTML = '<section class="card"><h2>C++ engine not built</h2><p>securecore.js / securecore.wasm are missing. Build them with emcc (see README) or let the GitHub Actions workflow do it.</p></section>';
} else {
  SecureCoreModule().then(start);
}
function start(Module) {
/* SecureCore — Module 04: Tree Data Structure.
   Plain JavaScript only. Sections: 1 data, 2 tree helpers, 3 algorithms,
   4 animation player, 5 tree drawing, 6 search, 7 traversal, 8 access. */

/* ===== 1. DATA (owned by the C++ engine, built to WebAssembly) ===== */
// call(): run a C++ function and get its string result.
const call = (fn, types, args) => Module.ccall(fn, "string", types, args);
const tree = JSON.parse(call("sc_tree_json", [], []));              // { name, children }
const PERMISSIONS = JSON.parse(call("sc_permissions_json", [], [])); // separate permission list

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => s.trim().toLowerCase();
const setMsg = (sel, text, cls = "") => { const e = $(sel); e.textContent = text; e.className = "msg " + cls; };
let SPEED = 700; // ms per animation step (changed by the Speed menus)

/* ===== 2. TREE HELPERS (parent and depth come from one walk) ===== */
const info = new Map(); // zone name -> { node, parent, depth }
(function index(n, parent = null, depth = 0) {
  info.set(n.name, { node: n, parent, depth });
  n.children.forEach(c => index(c, n, depth + 1));
})(tree);
const maxDepth = Math.max(...[...info.values()].map(v => v.depth));
function pathTo(name) {
  const p = [];
  let n = info.has(name) ? info.get(name).node : null;
  while (n) { p.unshift(n.name); n = info.get(n.name).parent; }
  return p;
}

/* ===== 3. ALGORITHMS (implemented in src/securecore.cpp) ===== */
const traverse = kind => call("sc_traverse", ["string"], [kind]).split("|");
const preorder = () => traverse("pre");
const postorder = () => traverse("post");
const levelorder = () => traverse("level");
// C++ returns "1|a|b|c" (found) or "0|a|b|c"; the visited order is pushed into `visited`.
function searchCpp(kind, target, visited) {
  const r = call("sc_search", ["string", "string"], [kind, target]).split("|");
  visited.push(...r.slice(1));
  return r[0] === "1";
}
const dfsSearch = (_root, target, visited) => searchCpp("dfs", target, visited);
const bfsSearch = (_root, target, visited) => searchCpp("bfs", target, visited);

/* ===== 4. ANIMATION PLAYER (shared by search and traversal) ===== */
function makePlayer(render, onEnd) {
  let seq = [], i = 0, t = null;
  const api = {
    load(s) { api.pause(); seq = s; i = 0; render(seq, 0); },
    pause() { clearInterval(t); t = null; },
    step() {
      if (i >= seq.length) return;
      i++; render(seq, i);
      if (i === seq.length) { api.pause(); if (onEnd) onEnd(seq); }
    },
    play() {
      if (!seq.length || t) return;
      if (i >= seq.length) { i = 0; render(seq, 0); }
      t = setInterval(api.step, SPEED);
    },
    reset() { api.pause(); i = 0; render(seq, 0); },
    get size() { return seq.length; }
  };
  return api;
}

/* ===== 5. TREE DRAWING (SVG generated from the data) ===== */
const collapsed = new Set();
let selected = null, zoom = 1;
let hl = { visiting: null, visited: new Set(), path: new Set() };
const clearHl = () => { hl = { visiting: null, visited: new Set(), path: new Set() }; };
const NW = 124, NH = 38, GX = 16, GY = 60;

// Leaves get consecutive x slots; a parent sits above the middle of its children.
function layout() {
  const pos = new Map(); let leaf = 0, maxD = 0;
  (function go(n, d) {
    maxD = Math.max(maxD, d);
    const kids = collapsed.has(n.name) ? [] : n.children;
    if (!kids.length) { pos.set(n.name, { x: leaf++, d }); return; }
    kids.forEach(c => go(c, d + 1));
    pos.set(n.name, { x: (pos.get(kids[0].name).x + pos.get(kids[kids.length - 1].name).x) / 2, d });
  })(tree, 0);
  return { pos, leaves: leaf, maxD };
}

function drawTree() {
  const { pos, leaves, maxD } = layout();
  const LM = 54, W = 20 + LM + (leaves - 1) * (NW + GX) + NW, H = 20 + (maxD + 1) * NH + maxD * GY;
  const X = x => 10 + LM + x * (NW + GX), Y = d => 10 + d * (NH + GY);
  let lines = "", nodes = "";
  for (let d = 0; d <= maxD; d++) lines += `<text class="depthlbl" x="6" y="${Y(d) + NH / 2 + 4}">Depth ${d}</text>`;
  (function go(n) {
    const p = pos.get(n.name), hidden = collapsed.has(n.name) && n.children.length;
    if (!collapsed.has(n.name)) n.children.forEach(c => {
      const q = pos.get(c.name), x1 = X(p.x) + NW / 2, y1 = Y(p.d) + NH, x2 = X(q.x) + NW / 2, y2 = Y(q.d), m = (y1 + y2) / 2;
      lines += `<path class="edge" d="M${x1} ${y1}C${x1} ${m} ${x2} ${m} ${x2} ${y2}"/>`;
      go(c);
    });
    const cls = ["node"];
    if (n.name === selected) cls.push("sel");
    if (hl.visiting === n.name) cls.push("visiting");
    else if (hl.path.has(n.name)) cls.push("path");
    else if (hl.visited.has(n.name)) cls.push("visited");
    nodes += `<g class="${cls.join(" ")}" data-name="${esc(n.name)}" tabindex="0" role="button" aria-label="${esc(n.name)}, depth ${p.d}">` +
      `<rect x="${X(p.x)}" y="${Y(p.d)}" width="${NW}" height="${NH}" rx="8"/>` +
      `<text x="${X(p.x) + NW / 2}" y="${Y(p.d) + NH / 2 + 4}" text-anchor="middle">${esc(n.name)}${hidden ? " (+)" : ""}</text></g>`;
  })(tree);
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="${W * zoom}" height="${H * zoom}" role="img" aria-label="Laboratory zone tree">${lines}${nodes}</svg>`;
  document.querySelectorAll(".treeview").forEach(box => { box.innerHTML = svg; });
}

function showDetails() {
  const box = $("#nodeInfo");
  if (!selected) { box.innerHTML = '<p class="muted">Click any zone in the tree to inspect it.</p>'; return; }
  const { node, parent, depth } = info.get(selected);
  const rows = [
    ["Zone", node.name],
    ["Parent zone", parent ? parent.name : "None (this is the root)"],
    ["Child zones", node.children.map(c => c.name).join(", ") || "None"],
    ["Depth from root", depth],
    ["Direct children", node.children.length],
    ["Leaf node?", node.children.length ? "No" : "Yes"],
    ["Path from root", pathTo(node.name).join(" → ")]
  ];
  box.innerHTML = "<dl>" + rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("") + "</dl>";
}

function selectNode(name) {
  if (!info.has(name)) return;
  selected = name;
  $("#zSel").value = name; // keep the access form in sync
  showDetails(); drawTree();
}
function toggleBranch(name) {
  if (!name || !info.get(name).node.children.length) return;
  collapsed.has(name) ? collapsed.delete(name) : collapsed.add(name);
  drawTree();
}
const expandAll = () => collapsed.clear();
function onTree(type, fn) { document.querySelectorAll(".treeview").forEach(b => b.addEventListener(type, fn)); }

onTree("click", e => { const g = e.target.closest(".node"); if (g) selectNode(g.dataset.name); });
onTree("dblclick", e => { const g = e.target.closest(".node"); if (g) toggleBranch(g.dataset.name); });
onTree("keydown", e => {
  const g = e.target.closest(".node");
  if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectNode(g.dataset.name); }
});
$("#btnExpand").onclick = () => { expandAll(); drawTree(); };
$("#btnCollapse").onclick = () => { info.forEach((v, k) => { if (v.node.children.length && v.parent) collapsed.add(k); }); drawTree(); };
$("#btnToggle").onclick = () => selected ? toggleBranch(selected) : ($("#nodeInfo").innerHTML = '<p class="msg warn">Select a zone first, then toggle its branch.</p>');
$("#btnZoomIn").onclick = () => { zoom = Math.min(1.6, zoom + 0.15); drawTree(); };
$("#btnZoomOut").onclick = () => { zoom = Math.max(0.5, zoom - 0.15); drawTree(); };
$("#btnClearSel").onclick = () => { selected = null; showDetails(); drawTree(); };
$("#btnResetView").onclick = () => { expandAll(); zoom = 1; selected = null; clearHl(); showDetails(); drawTree(); };

/* ===== 6. ZONE SEARCH ===== */
let sResult = null;
const sPlayer = makePlayer((seq, i) => {
  const vis = seq.slice(0, i);
  hl = { visiting: i ? seq[i - 1] : null, visited: new Set(vis.slice(0, -1)), path: new Set() };
  $("#searchOrder").textContent = vis.join(" → ") || "—";
  $("#searchCount").textContent = i;
  if (sResult && i > 0 && i === seq.length) {
    if (sResult.found) {
      const last = seq[i - 1];
      hl.visiting = null; hl.path = new Set(pathTo(last));
      setMsg("#searchResult", `${sResult.kind} found "${last}" after examining ${i} node(s). Path: ${pathTo(last).join(" → ")}`, "ok");
    } else setMsg("#searchResult", `Zone not found. ${sResult.kind} examined all ${i} nodes.`, "err");
  } else if (sResult) setMsg("#searchResult", `${sResult.kind} is searching…`);
  drawTree();
});
function runSearch(kind) {
  const target = norm($("#zoneInput").value);
  if (!target) { setMsg("#searchResult", "Type a zone name before searching.", "warn"); return; }
  expandAll();
  const seq = [];
  const found = kind === "DFS" ? dfsSearch(tree, target, seq) : bfsSearch(tree, target, seq);
  sResult = { kind, found };
  sPlayer.load(seq); sPlayer.play();
}
function resetSearch() {
  sResult = null; sPlayer.load([]); $("#compareBox").innerHTML = "";
  setMsg("#searchResult", "Enter a zone and choose a search. The tree above highlights each visited node.");
}
$("#btnDfs").onclick = () => runSearch("DFS");
$("#btnBfs").onclick = () => runSearch("BFS");
$("#btnSearchReset").onclick = resetSearch;
$("#btnCompare").onclick = compareSearch;
document.querySelectorAll(".spd").forEach(sel => { sel.onchange = () => { SPEED = +sel.value; document.querySelectorAll(".spd").forEach(o => { o.value = sel.value; }); }; });
$("#zoneInput").addEventListener("keydown", e => { if (e.key === "Enter") runSearch("DFS"); });

/* ===== 7. TRAVERSAL LAB ===== */
const TRAV = {
  pre: { label: "Preorder", fn: () => preorder(tree), text: "Preorder visits a node first, then each child from left to right. Good for copying a tree or printing an outline." },
  post: { label: "Postorder", fn: () => postorder(tree), text: "Postorder visits every child first, then the node itself. Good for deleting a tree: children go before parents." },
  level: { label: "Level-order", fn: () => levelorder(tree), text: "Level-order uses a queue: the root, then every depth-1 zone, then every depth-2 zone, and so on." }
};
let curTrav = null;
const tPlayer = makePlayer((seq, i) => {
  const vis = seq.slice(0, i);
  hl = { visiting: i ? seq[i - 1] : null, visited: new Set(vis.slice(0, -1)), path: new Set() };
  $("#travOut").textContent = vis.join(", ") || "—";
  $("#travCount").textContent = `${i} of ${seq.length || info.size}`;
  drawTree();
});
function setTrav(kind, autoplay) {
  curTrav = kind; expandAll();
  document.querySelectorAll("[data-trav]").forEach(b => b.classList.toggle("on", b.dataset.trav === kind));
  setMsg("#travInfo", TRAV[kind].text);
  tPlayer.load(TRAV[kind].fn());
  if (autoplay) tPlayer.play();
}
document.querySelectorAll("[data-trav]").forEach(b => b.onclick = () => setTrav(b.dataset.trav, true));
$("#btnPlay").onclick = () => { if (!curTrav) setTrav("pre", false); tPlayer.play(); };
$("#btnPause").onclick = () => tPlayer.pause();
$("#btnStep").onclick = () => { if (!curTrav) setTrav("pre", false); tPlayer.pause(); tPlayer.step(); };
$("#btnTReset").onclick = () => { if (!curTrav) { clearHl(); drawTree(); } else tPlayer.reset(); };

/* ===== 8. ACCESS VERIFICATION + ACTIVITY LOG ===== */
const log = [];
function fillSelects() {
  $("#rSel").innerHTML = '<option value="">Select researcher</option>' +
    Object.keys(PERMISSIONS).map(id => `<option value="${id}">${id} — ${esc(PERMISSIONS[id].name)}</option>`).join("");
  $("#zSel").innerHTML = '<option value="">Select zone</option>' +
    [...info.keys()].map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
}
// The decision is made in C++: only the permissions list can grant access.
function decide(id, zone) {
  const r = call("sc_decide", ["string", "string"], [id, zone]);
  return { granted: r[0] === "1", reason: r.slice(2) };
}
function checkAccess() {
  const id = $("#rSel").value, zone = $("#zSel").value;
  const rec = Object.prototype.hasOwnProperty.call(PERMISSIONS, id) ? PERMISSIONS[id] : null;
  const { granted, reason } = decide(id, zone);

  const box = $("#accessResult");
  box.className = "res " + (granted ? "granted" : "denied");
  box.innerHTML = `<div class="decision">${granted ? "ACCESS GRANTED" : "ACCESS DENIED"}</div>` +
    `<div><b>Researcher:</b> ${esc(rec ? rec.name : "Unknown")} (${esc(rec ? id : id || "none")})</div>` +
    `<div><b>Requested zone:</b> ${esc(zone || "none")}</div><div><b>Reason:</b> ${esc(reason)}</div>`;
  const last = $("#stLast");
  last.textContent = granted ? "GRANTED" : "DENIED";
  last.className = granted ? "granted" : "denied";
  log.unshift({ time: new Date().toLocaleTimeString(), id: rec ? id : id || "—", name: rec ? rec.name : "Unknown", zone: zone || "—", granted });
  if (log.length > 20) log.pop();
  renderLog();
}
function renderLog() {
  $("#logBody").innerHTML = log.length
    ? log.map(r => `<tr><td>${esc(r.time)}</td><td>${esc(r.id)}</td><td>${esc(r.name)}</td><td>${esc(r.zone)}</td>` +
        `<td class="${r.granted ? "g" : "d"}">${r.granted ? "Granted" : "Denied"}</td></tr>`).join("")
    : '<tr><td colspan="5" class="muted">No checks yet.</td></tr>';
}
$("#btnCheck").onclick = checkAccess;
$("#btnClearRes").onclick = () => { $("#accessResult").className = "res"; $("#accessResult").textContent = "Select a researcher and a zone, then press Check Permission."; };
// Two-step confirmation (first click arms the button, second click clears).
let clearArmed = null;
$("#btnClearLog").onclick = () => {
  const b = $("#btnClearLog");
  if (!log.length) { b.textContent = "Log is already empty"; setTimeout(() => b.textContent = "Clear Activity", 1800); return; }
  if (!clearArmed) {
    b.textContent = "Click again to confirm";
    clearArmed = setTimeout(() => { clearArmed = null; b.textContent = "Clear Activity"; }, 4000);
    return;
  }
  clearTimeout(clearArmed); clearArmed = null; b.textContent = "Clear Activity";
  log.length = 0; renderLog();
  $("#stLast").textContent = "None yet"; $("#stLast").className = "";
};

/* ===== EXTRAS: compare search, permissions table ===== */
function compareSearch() {
  const raw = $("#zoneInput").value, target = norm(raw);
  if (!target) { setMsg("#searchResult", "Type a zone name before comparing.", "warn"); return; }
  sPlayer.pause(); sResult = null; sPlayer.load([]); // clears highlights
  const d = [], b = [];
  const fd = dfsSearch(tree, target, d), fb = bfsSearch(tree, target, b);
  const row = (n, v, f) => `<tr><td>${n}</td><td>${esc(v.join(" → "))}</td><td>${v.length}</td><td>${f ? "Found" : "Not found"}</td></tr>`;
  $("#compareBox").innerHTML = '<div class="tablewrap"><table><thead><tr><th>Method</th><th>Visited order</th><th>Nodes examined</th><th>Result</th></tr></thead><tbody>' + row("DFS", d, fd) + row("BFS", b, fb) + "</tbody></table></div>";
  setMsg("#searchResult", fd ? `For "${raw.trim()}": DFS examined ${d.length} node(s) and BFS examined ${b.length}. Which is fewer depends on where the zone sits.` : `Zone not found. Both searches examined all ${d.length} nodes.`, fd ? "ok" : "err");
}
function renderPerms() {
  $("#permBody").innerHTML = Object.keys(PERMISSIONS).map(id =>
    `<tr><td>${id}</td><td>${esc(PERMISSIONS[id].name)}</td><td>${esc(PERMISSIONS[id].zones.join(", "))}</td></tr>`).join("");
  $("#zoneList").innerHTML = [...info.keys()].map(n => `<option value="${esc(n)}">`).join("");
}
/* ===== INIT ===== */
$("#stZones").textContent = info.size;
$("#stRes").textContent = Object.keys(PERMISSIONS).length;
$("#stDepth").textContent = maxDepth;
fillSelects(); renderPerms(); showDetails(); drawTree(); renderLog();

/* ===== NAVIGATION: show one section at a time ===== */
const sections = [...document.querySelectorAll("main section")], links = [...document.querySelectorAll("nav a")];
function show(id) {
  if (!sections.some(x => x.id === id)) id = "overview";
  sections.forEach(x => { x.hidden = x.id !== id; });
  links.forEach(a => { const on = a.hash === "#" + id; a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
  window.scrollTo(0, 0);
}
links.forEach(a => a.addEventListener("click", e => { e.preventDefault(); show(a.hash.slice(1)); }));
document.querySelectorAll("[data-go]").forEach(b => { b.onclick = () => show(b.dataset.go); });
show(location.hash.slice(1));
}

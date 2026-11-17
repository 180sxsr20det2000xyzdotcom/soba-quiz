// 相場クイズ本体
const STORE_KEY = "soba-quiz-v1";
const app = document.getElementById("app");

// ---- 保存データ（端末内 localStorage） ----
// stats[qid] = { seen, correct, lastOk }
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { stats: {}, count: 10 }; }
  catch { return { stats: {}, count: 10 }; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}
let state = load();
if (!state.stats) state.stats = {};
if (!state.count) state.count = 10;

let session = null; // { title, list: [{q, order}], i, answered, results: [] }

const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const wrongList = () => QUESTIONS.filter((q) => state.stats[q.id] && state.stats[q.id].lastOk === false);

// ---- ホーム ----
function renderHome() {
  session = null;
  const total = QUESTIONS.length;
  const mastered = QUESTIONS.filter((q) => state.stats[q.id]?.lastOk).length;
  const wrongs = wrongList().length;

  const cats = CATEGORIES.map((c) => {
    const qs = QUESTIONS.filter((q) => q.cat === c.id);
    const ok = qs.filter((q) => state.stats[q.id]?.lastOk).length;
    const pct = Math.round((ok / qs.length) * 100);
    return `<button class="cat-btn" data-cat="${c.id}">
      <span class="emoji">${c.icon}</span>
      <span class="body">${esc(c.name)}
        <div class="meta">${qs.length}問 ・ 正解済み ${ok}/${qs.length}</div>
        <div class="bar"><span style="width:${pct}%"></span></div>
      </span></button>`;
  }).join("");

  app.innerHTML = `
    <header><h1>相場クイズ</h1></header>
    <div class="card">
      <div class="muted">全体の習得状況</div>
      <div style="font-size:22px;font-weight:700">${mastered} / ${total} 問</div>
      <div class="bar"><span style="width:${Math.round((mastered / total) * 100)}%"></span></div>
      <div class="muted" style="margin-top:12px">1回の出題数</div>
      <div class="seg">${[5, 10, 20].map((n) => `<button data-count="${n}" class="${state.count === n ? "on" : ""}">${n}問</button>`).join("")}</div>
    </div>
    <button class="cat-btn" data-cat="all"><span class="emoji">🎲</span><span class="body">全カテゴリからランダム<div class="meta">${total}問から出題</div></span></button>
    ${cats}
    <button class="secondary" id="review" ${wrongs ? "" : "disabled"}>間違えた問題を復習（${wrongs}問）</button>
    <button class="icon-btn" id="reset" style="display:block;margin:20px auto 0">学習記録をリセット</button>
  `;

  app.querySelectorAll("[data-count]").forEach((b) => b.onclick = () => {
    state.count = Number(b.dataset.count); save(); renderHome();
  });
  app.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => {
    const cat = b.dataset.cat;
    const pool = cat === "all" ? QUESTIONS : QUESTIONS.filter((q) => q.cat === cat);
    const title = cat === "all" ? "全カテゴリ" : CATEGORIES.find((c) => c.id === cat).name;
    startQuiz(title, pickQuestions(pool, state.count));
  });
  document.getElementById("review").onclick = () => startQuiz("復習", shuffle(wrongList()));
  document.getElementById("reset").onclick = () => {
    if (confirm("学習記録をすべて消去します。よろしいですか？")) { state.stats = {}; save(); renderHome(); }
  };
}

// 未出題・間違えた問題を優先して選ぶ
function pickQuestions(pool, n) {
  const weight = (q) => {
    const s = state.stats[q.id];
    if (!s) return 0;            // 未出題
    if (s.lastOk === false) return 1; // 前回間違い
    return 2;                     // 正解済み
  };
  return shuffle(pool).sort((a, b) => weight(a) - weight(b)).slice(0, n);
}

// ---- クイズ ----
function startQuiz(title, qs) {
  session = {
    title, i: 0, results: [],
    list: qs.map((q) => ({ q, order: shuffle(q.choices.map((_, k) => k)) })),
  };
  renderQuestion();
}

function renderQuestion() {
  const { list, i, title } = session;
  const { q, order } = list[i];
  const cat = CATEGORIES.find((c) => c.id === q.cat);
  app.innerHTML = `
    <header><button class="icon-btn" id="quit">✕ やめる</button><h1></h1></header>
    <div class="q-head"><span>${title === cat.name ? "" : esc(title) + " ・ "}${cat.icon} ${esc(cat.name)}</span><span>${i + 1} / ${list.length}</span></div>
    <div class="bar"><span style="width:${(i / list.length) * 100}%"></span></div>
    <div class="q-text">${esc(q.q)}</div>
    <div id="choices">${order.map((k) => `<button class="choice" data-k="${k}">${esc(q.choices[k])}</button>`).join("")}</div>
    <div id="after"></div>
  `;
  document.getElementById("quit").onclick = () => {
    if (!session.results.length || confirm("途中でやめますか？（ここまでの記録は保存されます）")) renderHome();
  };
  app.querySelectorAll(".choice").forEach((b) => b.onclick = () => answer(Number(b.dataset.k)));
  window.scrollTo(0, 0);
}

function answer(k) {
  const { q } = session.list[session.i];
  const ok = k === q.answer;
  const s = state.stats[q.id] || { seen: 0, correct: 0 };
  s.seen++; if (ok) s.correct++; s.lastOk = ok;
  state.stats[q.id] = s; save();
  session.results.push({ q, ok, picked: k });

  app.querySelectorAll(".choice").forEach((b) => {
    const bk = Number(b.dataset.k);
    b.disabled = true;
    if (bk === q.answer) b.classList.add("correct");
    else if (bk === k) b.classList.add("wrong");
  });
  const last = session.i === session.list.length - 1;
  document.getElementById("after").innerHTML = `
    <div class="feedback ${ok ? "ok" : "ng"}"><b>${ok ? "⭕ 正解！" : "❌ 不正解"}</b>${esc(q.exp)}</div>
    <button class="primary" id="next">${last ? "結果を見る" : "次の問題へ"}</button>
  `;
  const next = document.getElementById("next");
  next.onclick = () => { if (last) renderResult(); else { session.i++; renderQuestion(); } };
  next.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---- 結果 ----
function renderResult() {
  const r = session.results;
  const ok = r.filter((x) => x.ok).length;
  const pct = Math.round((ok / r.length) * 100);
  const msg = pct === 100 ? "パーフェクト！🎉" : pct >= 80 ? "よくできました！" : pct >= 50 ? "あと少し！" : "解説を読んで復習しよう";
  const wrongs = r.filter((x) => !x.ok);
  const lastList = session.list.map((x) => x.q);
  const title = session.title;

  app.innerHTML = `
    <header><h1>結果</h1></header>
    <div class="card center">
      <div class="muted">${esc(title)}</div>
      <div class="score">${ok} / ${r.length}</div>
      <div>${msg}</div>
    </div>
    ${wrongs.length ? `<div class="card"><div class="muted" style="margin-bottom:4px">間違えた問題</div>
      ${wrongs.map((x) => `<div class="review-item">${esc(x.q.q)}<br>
        <span class="a">正解：${esc(x.q.choices[x.q.answer])}</span></div>`).join("")}</div>` : ""}
    <div class="row">
      <button class="secondary" id="again">もう一度</button>
      ${wrongs.length ? `<button class="secondary" id="retry">間違いだけ</button>` : ""}
    </div>
    <button class="primary" id="home">ホームへ</button>
  `;
  document.getElementById("again").onclick = () => startQuiz(title, shuffle(lastList));
  if (wrongs.length) document.getElementById("retry").onclick = () => startQuiz("復習", shuffle(wrongs.map((x) => x.q)));
  document.getElementById("home").onclick = renderHome;
  window.scrollTo(0, 0);
}

renderHome();

// オフラインでも動くように Service Worker を登録
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

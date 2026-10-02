import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCTTs_V7bsynq3TOUGPHDiYvkOzxbqlY6c",
  authDomain: "veraldo-em-edf.firebaseapp.com",
  projectId: "veraldo-em-edf",
  storageBucket: "veraldo-em-edf.firebasestorage.app",
  messagingSenderId: "215346817189",
  appId: "1:215346817189:web:4edb93649316b7ee8dc54c"
};

const PROFESSOR_UID = "v9NYzhMAx3cenXg29nFClPQjsRJ3";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let attempts = [];
let questions = new Map();
let keys = new Map();
let filtered = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) return "—";
  return timestamp.toDate().toLocaleString("pt-BR");
}

function dateKey(timestamp) {
  if (!timestamp?.toDate) return "";
  const d = timestamp.toDate();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function scoreAttempt(a) {
  const ids = a.questionIds || [];
  const ans = a.answers || {};
  let correct = 0;
  ids.forEach(id => {
    if (ans[id] && keys.get(id)?.correta === ans[id]) correct++;
  });
  return { correct, percent: ids.length ? Math.round((correct / ids.length) * 100) : 0 };
}

function applyFilters() {
  const turma = $("filter-turma").value;
  const turno = $("filter-turno").value;
  const date = $("filter-date").value;

  filtered = attempts.filter(a =>
    (!turma || a.turma === turma) &&
    (!turno || a.turno === turno) &&
    (!date || dateKey(a.createdAt) === date)
  ).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  $("total-label").textContent = `${filtered.length} atividade(s) encontrada(s)`;

  $("results-body").innerHTML = filtered.map((a, index) => {
    const score = scoreAttempt(a);
    return `
      <tr data-index="${index}">
        <td>${escapeHtml(a.nome)}</td>
        <td>${escapeHtml(a.turma)}</td>
        <td>${escapeHtml(a.turno)}</td>
        <td>${score.correct}</td>
        <td>${score.percent}%</td>
        <td>${formatDate(a.createdAt)}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="6">Nenhum resultado encontrado.</td></tr>`;

  document.querySelectorAll("#results-body tr[data-index]").forEach(row => {
    row.addEventListener("click", () => showDetail(filtered[Number(row.dataset.index)]));
  });
}

async function loadData() {
  $("panel-error").hidden = true;
  const [qSnap, kSnap, aSnap] = await Promise.all([
    getDocs(collection(db, "questoes_publicas")),
    getDocs(collection(db, "gabaritos")),
    getDocs(collection(db, "tentativas"))
  ]);

  questions = new Map(qSnap.docs.map(d => [d.id, {id:d.id, ...d.data()}]));
  keys = new Map(kSnap.docs.map(d => [d.id, d.data()]));
  attempts = aSnap.docs.map(d => ({id:d.id, ...d.data()}));
  applyFilters();
}

function showDetail(a) {
  const score = scoreAttempt(a);
  $("detail-name").textContent = a.nome;
  $("detail-summary").textContent = `${a.turma} • ${a.turno} • ${formatDate(a.createdAt)} • Nota ${score.correct}/10 • ${score.percent}%`;

  $("detail-questions").innerHTML = (a.questionIds || []).map((id, i) => {
    const q = questions.get(id);
    const marked = a.answers?.[id] || "—";
    const correct = keys.get(id)?.correta || "—";
    const hit = marked === correct;

    return `
      <div class="detail-question">
        <div class="question-meta">Questão ${i+1} • ${escapeHtml(q?.conteudo || "")}</div>
        <div class="question-body">${escapeHtml(q?.enunciado || "")}</div>
        <p class="question-text">${escapeHtml(q?.pergunta || "")}</p>
        <div><strong>Resposta marcada:</strong> ${escapeHtml(marked)}</div>
        <div><strong>Resposta correta:</strong> ${escapeHtml(correct)}</div>
        <div class="detail-result ${hit ? "good" : "bad"}">${hit ? "Acertou" : "Errou"}</div>
      </div>
    `;
  }).join("");

  $("detail-card").hidden = false;
  window.scrollTo({top: $("detail-card").offsetTop - 10, behavior:"smooth"});
}

function exportCsv() {
  const rows = [
    ["Nome","Turma","Turno","Acertos","Percentual","Data e horário"]
  ];
  filtered.forEach(a => {
    const s = scoreAttempt(a);
    rows.push([a.nome, a.turma, a.turno, s.correct, `${s.percent}%`, formatDate(a.createdAt)]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `resultados_educacao_fisica_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-error").hidden = true;
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  } catch (err) {
    console.error(err);
    $("login-error").textContent = "E-mail ou senha incorretos.";
    $("login-error").hidden = false;
  }
});

$("logout-btn").addEventListener("click", () => signOut(auth));
$("filter-turma").addEventListener("change", applyFilters);
$("filter-turno").addEventListener("change", applyFilters);
$("filter-date").addEventListener("change", applyFilters);
$("clear-filters").addEventListener("click", () => {
  $("filter-turma").value = "";
  $("filter-turno").value = "";
  $("filter-date").value = "";
  applyFilters();
});
$("export-csv").addEventListener("click", exportCsv);
$("close-detail").addEventListener("click", () => $("detail-card").hidden = true);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("login-card").hidden = false;
    $("panel-card").hidden = true;
    return;
  }
  if (user.uid !== PROFESSOR_UID) {
    await signOut(auth);
    $("login-error").textContent = "Este acesso não está autorizado para o painel.";
    $("login-error").hidden = false;
    return;
  }
  $("login-card").hidden = true;
  $("panel-card").hidden = false;
  try {
    await loadData();
  } catch (err) {
    console.error(err);
    $("panel-error").textContent = "Não foi possível carregar os resultados.";
    $("panel-error").hidden = false;
  }
});

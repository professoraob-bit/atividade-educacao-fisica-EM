import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCTTs_V7bsynq3TOUGPHDiYvkOzxbqlY6c",
  authDomain: "veraldo-em-edf.firebaseapp.com",
  projectId: "veraldo-em-edf",
  storageBucket: "veraldo-em-edf.firebasestorage.app",
  messagingSenderId: "215346817189",
  appId: "1:215346817189:web:4edb93649316b7ee8dc54c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let quiz = [];
let answers = {};
let current = 0;
let student = null;
let submitting = false;

const $ = (id) => document.getElementById(id);
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

function serieBanco(turma) {
  if (turma.startsWith("1ª")) return "1ª série";
  if (turma.startsWith("2ª")) return "2ª série";
  return turma;
}

function renderQuestion() {
  const q = quiz[current];
  $("progress-text").textContent = `Questão ${current + 1} de ${quiz.length}`;
  $("progress-fill").style.width = `${((current + 1) / quiz.length) * 100}%`;

  const options = ["A","B","C","D","E"];
  const selected = answers[q.id] || "";

  $("question-container").innerHTML = `
    <div class="question-meta">${q.tipo || "Questão"} • ${q.conteudo}</div>
    <div class="question-body">${escapeHtml(q.enunciado)}</div>
    <p class="question-text">${escapeHtml(q.pergunta)}</p>
    <div>
      ${options.map(letter => `
        <label class="option">
          <input type="radio" name="answer" value="${letter}" ${selected === letter ? "checked" : ""}>
          <span><strong>${letter})</strong> ${escapeHtml(q[letter])}</span>
        </label>
      `).join("")}
    </div>
  `;

  document.querySelectorAll('input[name="answer"]').forEach(input => {
    input.addEventListener("change", (e) => {
      answers[q.id] = e.target.value;
    });
  });

  $("next-btn").hidden = current === quiz.length - 1;
  $("finish-btn").hidden = current !== quiz.length - 1;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function allAnswered() {
  return quiz.every(q => !!answers[q.id]);
}

async function startQuiz(event) {
  event.preventDefault();
  $("start-error").hidden = true;

  const nome = $("nome").value.trim();
  const turma = $("turma").value;
  const turno = $("turno").value;

  if (!nome || !turma || !turno) return;

  try {
    await signInAnonymously(auth);

    const qref = query(
      collection(db, "questoes_publicas"),
      where("serie", "==", serieBanco(turma))
    );
    const snap = await getDocs(qref);
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (all.length < 10) throw new Error("Não foi possível carregar 10 questões desta série.");

    quiz = shuffle(all).slice(0, 10);
    quiz = shuffle(quiz);
    answers = {};
    current = 0;
    student = { nome, turma, turno };

    $("start-card").hidden = true;
    $("quiz-card").hidden = false;
    renderQuestion();
    window.scrollTo({top:0, behavior:"smooth"});
  } catch (err) {
    console.error(err);
    $("start-error").textContent = "Não foi possível iniciar a atividade. Tente novamente.";
    $("start-error").hidden = false;
  }
}

$("next-btn").addEventListener("click", () => {
  if (!answers[quiz[current].id]) {
    $("quiz-error").textContent = "Responda à questão antes de continuar.";
    $("quiz-error").hidden = false;
    return;
  }
  $("quiz-error").hidden = true;
  current++;
  renderQuestion();
  window.scrollTo({top:0, behavior:"smooth"});
});

$("finish-btn").addEventListener("click", async () => {
  $("quiz-error").hidden = true;
  if (!allAnswered()) {
    $("quiz-error").textContent = "Responda todas as questões antes de finalizar.";
    $("quiz-error").hidden = false;
    return;
  }
  if (submitting) return;
  submitting = true;
  $("finish-btn").disabled = true;

  try {
    await addDoc(collection(db, "tentativas"), {
      studentUid: auth.currentUser.uid,
      nome: student.nome,
      turma: student.turma,
      turno: student.turno,
      questionIds: quiz.map(q => q.id),
      answers,
      createdAt: serverTimestamp()
    });

    $("quiz-card").hidden = true;
    $("done-card").hidden = false;
    window.scrollTo({top:0, behavior:"smooth"});
  } catch (err) {
    console.error(err);
    $("finish-btn").disabled = false;
    submitting = false;
    $("quiz-error").textContent = "Não foi possível registrar a atividade. Tente novamente.";
    $("quiz-error").hidden = false;
  }
});

$("student-form").addEventListener("submit", startQuiz);

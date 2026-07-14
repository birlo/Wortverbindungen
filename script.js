/* ---------------- Puzzle loading ---------------- */
function parsePuzzles(csv){
  const map = {};
  csv.split("\n").forEach(line => {
    if(!line.trim()) return;
    const parts = line.split(";");
    if(parts.length < 6) return;
    const id = parseInt(parts[0],10);
    const title = parts[1];
    const words = parts[2].split(",").map(w=>w.trim());
    const color = "#" + parts[3];
    const difficulty = parseInt(parts[4],10);
    const hint = parts[5];
    if(!map[id]) map[id] = [];
    map[id].push({title, words, color, difficulty, hint});
  });
  return Object.keys(map).map(id => ({id:parseInt(id,10), categories:map[id]})).sort((a,b)=>a.id-b.id);
}

let PUZZLES = [];

/* ---------------- State ---------------- */
let screen = "loading"; // loading | error | menu | game
let progress = {}; // id -> {solved, errors, hints}
let gs = null; // game state

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function startGame(puzzle){
  gs = {
    puzzle,
    allWords: shuffle(puzzle.categories.flatMap(c=>c.words)),
    selected: new Set(),
    solved: [],
    errors: 0,
    hintsUsed: 0,
    status: "Finde 4 Gruppen!",
    oneAway: false,
    oneAwayTimer: null,
    hintLevel: 0,
    targetHintCat: null,
    hintedWords: new Set(),
    activeHintSentence: null,
    fullScreen: false
  };
  screen = "game";
  render();
}

function remainingWords(){
  return gs.allWords.filter(w => !gs.solved.some(c => c.words.includes(w)));
}

function toggleWord(word){
  if(gs.selected.has(word)) gs.selected.delete(word);
  else if(gs.selected.size < 4) gs.selected.add(word);
  render();
}

function checkSelection(){
  const sel = gs.selected;
  const match = gs.puzzle.categories.find(c => c.words.length===sel.size && c.words.every(w=>sel.has(w)));
  if(match){
    gs.solved.push(match);
    gs.selected = new Set();
    gs.status = "Richtig!";
    gs.oneAway = false;
    if(match === gs.targetHintCat){
      gs.targetHintCat = null;
      gs.hintLevel = 0;
      gs.hintedWords = new Set();
      gs.activeHintSentence = null;
    }
    if(gs.solved.length === 4){
      progress[gs.puzzle.id] = {solved:true, errors:gs.errors, hints:gs.hintsUsed};
    }
  } else {
    const remaining = gs.puzzle.categories.filter(c => !gs.solved.includes(c));
    const closeMatch = remaining.some(c => c.words.filter(w=>sel.has(w)).length === 3);
    gs.errors++;
    gs.status = "Leider falsch";
    gs.oneAway = closeMatch;
    if(gs.oneAwayTimer) clearTimeout(gs.oneAwayTimer);
    if(closeMatch){
      gs.oneAwayTimer = setTimeout(()=>{ gs.oneAway=false; render(); }, 2000);
    }
  }
  render();
}

function shuffleWords(){
  const rem = remainingWords();
  const solvedWords = gs.allWords.filter(w=>!rem.includes(w));
  gs.allWords = [...shuffle(rem), ...solvedWords];
  render();
}

function clearSelection(){
  gs.selected = new Set();
  render();
}

function useHint(){
  gs.hintsUsed++;
  if(!gs.targetHintCat){
    const remaining = gs.puzzle.categories.filter(c=>!gs.solved.includes(c));
    gs.targetHintCat = remaining[Math.floor(Math.random()*remaining.length)];
  }
  gs.hintLevel++;
  const rem = remainingWords();
  if(gs.hintLevel === 1){
    gs.activeHintSentence = gs.targetHintCat.hint;
  } else if(gs.hintLevel === 2){
    const cand = gs.targetHintCat.words.filter(w=>rem.includes(w));
    if(cand.length) gs.hintedWords.add(cand[Math.floor(Math.random()*cand.length)]);
  } else if(gs.hintLevel === 3){
    const cand = gs.targetHintCat.words.filter(w=>rem.includes(w) && !gs.hintedWords.has(w));
    if(cand.length) gs.hintedWords.add(cand[Math.floor(Math.random()*cand.length)]);
  }
  gs.status = "Hinweis erhalten!";
  render();
}

function backToMenu(){
  screen = "menu";
  gs = null;
  render();
}

/* ---------------- Rendering ---------------- */
const app = document.getElementById("app");

function render(){
  app.innerHTML = "";
  if(screen === "loading") renderMessage("Rätsel werden geladen …");
  else if(screen === "error") renderMessage("Die Datei puzzles.csv konnte nicht geladen werden. Liegt sie im selben Ordner wie index.html?");
  else if(screen === "menu") renderMenu();
  else renderGame();
}

function renderMessage(text){
  const div = document.createElement("div");
  div.className = "state-msg";
  div.textContent = text;
  app.appendChild(div);
}

function renderMenu(){
  const wrap = document.createElement("div");
  wrap.className = "menu-wrap";

  wrap.innerHTML = `
    <div class="masthead">
      <h1>4×4 Wortverbindung</h1>
      <span class="kicker">Web-Edition</span>
    </div>
    <div class="subtitle">${PUZZLES.length} Rätsel · Wähle eins, um zu starten</div>
    <div class="puzzle-grid" id="grid"></div>
  `;
  app.appendChild(wrap);

  const grid = wrap.querySelector("#grid");
  PUZZLES.forEach(p => {
    const res = progress[p.id];
    const card = document.createElement("button");
    card.className = "puzzle-card" + (res && res.solved ? " solved" : "");
    card.innerHTML = `
      <div class="dots">${p.categories.map(c=>`<span style="background:${c.color}"></span>`).join("")}</div>
      <div class="num">${String(p.id).padStart(2,"0")}</div>
      <div class="status">${res && res.solved ? `${res.errors} Fehler · ${res.hints} Hinweise` : "Offen"}</div>
    `;
    card.onclick = () => startGame(p);
    grid.appendChild(card);
  });
}

function renderGame(){
  const rem = remainingWords();
  const won = gs.solved.length === 4;

  const wrap = document.createElement("div");
  wrap.className = "game-wrap";

  wrap.innerHTML = `
    <div class="game-header">
      <button class="back-btn" id="backBtn">Menü</button>
      <div class="puzzle-title">Rätsel ${String(gs.puzzle.id).padStart(2,"0")}</div>
      <button class="fs-btn" id="fsBtn">${gs.fullScreen ? "⤡" : "⤢"}</button>
    </div>
    <div class="game-body" id="body"></div>
  `;
  app.appendChild(wrap);

  wrap.querySelector("#backBtn").onclick = backToMenu;
  wrap.querySelector("#fsBtn").onclick = () => { gs.fullScreen = !gs.fullScreen; render(); };

  const body = wrap.querySelector("#body");

  const boardCol = document.createElement("div");
  boardCol.className = "board-col";

  if(won){
    boardCol.innerHTML = `
      <div class="win-screen">
        <h2>Hervorragend!</h2>
        <p>Rätsel gelöst mit ${gs.errors} Fehlern und ${gs.hintsUsed} Hinweisen.</p>
      </div>
    `;
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.style.maxWidth = "280px";
    btn.textContent = "Zurück zum Menü";
    btn.onclick = backToMenu;
    boardCol.querySelector(".win-screen").appendChild(btn);
    body.appendChild(boardCol);

    // Seitenleiste zeigt weiterhin alle vier gelösten Kategorien, inkl. der letzten
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    gs.solved.slice().sort((a,b)=>a.difficulty-b.difficulty).forEach(cat => {
      const card = document.createElement("div");
      card.className = "solved-card";
      card.style.background = cat.color;
      card.innerHTML = `<div class="cat-title">${cat.title}</div><div class="cat-words">${cat.words.join(", ")}</div>`;
      sidebar.appendChild(card);
    });
    body.appendChild(sidebar);
    return;
  }

  const gridEl = document.createElement("div");
  gridEl.className = "grid";
  rem.forEach(word => {
    const tile = document.createElement("div");
    tile.className = "tile" +
      (gs.selected.has(word) ? " selected" : "") +
      (gs.hintedWords.has(word) ? " hint" : "");
    const len = word.length;
    tile.style.fontSize = len > 10 ? "14px" : len > 8 ? "16px" : "19px";
    tile.textContent = word;
    tile.onclick = () => toggleWord(word);
    gridEl.appendChild(tile);
  });
  boardCol.appendChild(gridEl);

  if(gs.fullScreen){
    const checkBtn = document.createElement("button");
    checkBtn.className = "btn primary";
    checkBtn.style.marginTop = "10px";
    checkBtn.textContent = "Prüfen";
    checkBtn.disabled = gs.selected.size !== 4;
    checkBtn.onclick = checkSelection;
    boardCol.appendChild(checkBtn);
    body.appendChild(boardCol);
    return;
  }

  body.appendChild(boardCol);

  const sidebar = document.createElement("div");
  sidebar.className = "sidebar";

  gs.solved.slice().sort((a,b)=>a.difficulty-b.difficulty).forEach(cat => {
    const card = document.createElement("div");
    card.className = "solved-card";
    card.style.background = cat.color;
    card.innerHTML = `<div class="cat-title">${cat.title}</div><div class="cat-words">${cat.words.join(", ")}</div>`;
    sidebar.appendChild(card);
  });

  const statusCard = document.createElement("div");
  statusCard.className = "status-card";
  statusCard.innerHTML = `
    <div class="msg${gs.oneAway ? " away" : ""}">${gs.oneAway ? "Eins fehlt noch!" : gs.status}</div>
    ${gs.activeHintSentence ? `<div class="hint-text">${gs.activeHintSentence}</div>` : ""}
  `;
  sidebar.appendChild(statusCard);

  const counters = document.createElement("div");
  counters.className = "counters";
  counters.innerHTML = `<span class="err">Fehler: ${gs.errors}</span><span class="hnt">Hinweise: ${gs.hintsUsed}</span>`;
  sidebar.appendChild(counters);

  const checkBtn = document.createElement("button");
  checkBtn.className = "btn primary";
  checkBtn.textContent = "Prüfen";
  checkBtn.disabled = gs.selected.size !== 4;
  checkBtn.onclick = checkSelection;
  sidebar.appendChild(checkBtn);

  const row = document.createElement("div");
  row.className = "btn-row";
  const shuffleBtn = document.createElement("button");
  shuffleBtn.className = "btn";
  shuffleBtn.textContent = "Mischen";
  shuffleBtn.onclick = shuffleWords;
  const clearBtn = document.createElement("button");
  clearBtn.className = "btn";
  clearBtn.textContent = "Leeren";
  clearBtn.onclick = clearSelection;
  row.appendChild(shuffleBtn);
  row.appendChild(clearBtn);
  sidebar.appendChild(row);

  const hintBtn = document.createElement("button");
  hintBtn.className = "btn hint-btn";
  hintBtn.textContent = "Hinweis";
  hintBtn.onclick = useHint;
  sidebar.appendChild(hintBtn);

  body.appendChild(sidebar);
}

/* ---------------- Init ---------------- */
render();
fetch("puzzles.csv")
  .then(res => {
    if(!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  })
  .then(csv => {
    PUZZLES = parsePuzzles(csv);
    screen = "menu";
    render();
  })
  .catch(err => {
    console.error("Fehler beim Laden von puzzles.csv:", err);
    screen = "error";
    render();
  });

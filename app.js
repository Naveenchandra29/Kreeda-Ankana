const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00 -> 21:00

const STORAGE_KEYS = {
  bookings: "kreeda_bookings_v1",
  challenges: "kreeda_challenges_v1",
};

const firebaseConfig = {
  // Optional: fill this to enable cloud real-time challenge board.
  // apiKey: "...",
  // authDomain: "...",
  // databaseURL: "...",
  // projectId: "...",
};

const state = {
  bookings: JSON.parse(localStorage.getItem(STORAGE_KEYS.bookings) || "[]"),
  challenges: JSON.parse(localStorage.getItem(STORAGE_KEYS.challenges) || "[]"),
  scores: [],
  db: null,
  cloudEnabled: false,
};

const els = {
  bookingDay: document.getElementById("bookingDay"),
  bookingForm: document.getElementById("booking-form"),
  bookingMessage: document.getElementById("booking-message"),
  calendar: document.getElementById("calendar"),
  challengeForm: document.getElementById("challenge-form"),
  challengeList: document.getElementById("challenge-list"),
  scoreForm: document.getElementById("score-form"),
  scoreList: document.getElementById("score-list"),
};

function toTimeLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function parseHour(time) {
  return Number(time.split(":")[0]);
}

function showBookingMessage(msg, type = "success") {
  els.bookingMessage.className = `message ${type}`;
  els.bookingMessage.textContent = msg;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function persistBookings() {
  localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(state.bookings));
}

function persistChallenges() {
  localStorage.setItem(STORAGE_KEYS.challenges, JSON.stringify(state.challenges));
}

function fillDayOptions() {
  DAYS.forEach((day) => {
    const opt = document.createElement("option");
    opt.value = day;
    opt.textContent = day;
    els.bookingDay.appendChild(opt);
  });
}

function renderCalendar() {
  const header = `<tr><th>Time</th>${DAYS.map((d) => `<th>${d}</th>`).join("")}</tr>`;
  const rows = HOURS.map((hour) => {
    const cells = DAYS.map((day) => {
      const booking = state.bookings.find(
        (b) => b.day === day && hour >= b.startHour && hour < b.endHour,
      );
      return booking
        ? `<td class="slot-booked">${booking.team}<br/><small>${booking.sport}</small></td>`
        : "<td>-</td>";
    }).join("");

    return `<tr><td>${toTimeLabel(hour)}</td>${cells}</tr>`;
  }).join("");

  els.calendar.innerHTML = header + rows;
}

function initBooking() {
  fillDayOptions();
  renderCalendar();

  els.bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const payload = {
      team: document.getElementById("teamName").value.trim(),
      sport: document.getElementById("sportType").value,
      day: document.getElementById("bookingDay").value,
      startHour: parseHour(document.getElementById("startTime").value),
      endHour: parseHour(document.getElementById("endTime").value),
    };

    if (payload.endHour <= payload.startHour) {
      showBookingMessage("End time must be after start time.", "error");
      return;
    }

    const conflict = state.bookings.some(
      (b) => b.day === payload.day && overlaps(payload.startHour, payload.endHour, b.startHour, b.endHour),
    );

    if (conflict) {
      showBookingMessage("This slot is already booked by another team.", "error");
      return;
    }

    state.bookings.push(payload);
    persistBookings();
    renderCalendar();
    showBookingMessage("Slot booked! Keep the game spirit alive.", "success");
    els.bookingForm.reset();
  });
}

function challengeTemplate(challenge, id) {
  const replies = (challenge.replies || [])
    .map((r) => `<div>• ${r.team}: ${r.message}</div>`)
    .join("");

  return `
    <article class="item">
      <h4>${challenge.team} challenges for ${challenge.sport}</h4>
      <p><strong>Date:</strong> ${challenge.date}</p>
      <p>${challenge.message}</p>
      <div class="reply">
        <input placeholder="Your team reply" id="reply-${id}" />
        <button class="btn" data-reply-id="${id}">Reply</button>
      </div>
      <div class="reply-list">${replies || "No replies yet. Be the first!"}</div>
    </article>
  `;
}

function renderChallenges() {
  els.challengeList.innerHTML = state.challenges.length
    ? state.challenges.map((c, i) => challengeTemplate(c, i)).join("")
    : '<div class="item">No challenge yet. Post one now!</div>';

  els.challengeList.querySelectorAll("button[data-reply-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const i = Number(btn.dataset.replyId);
      const input = document.getElementById(`reply-${i}`);
      const text = input.value.trim();
      if (!text) return;

      const reply = { team: "Opponent Team", message: text };
      state.challenges[i].replies = state.challenges[i].replies || [];
      state.challenges[i].replies.push(reply);

      await saveChallenges();
      renderChallenges();
    });
  });
}

async function saveChallenges() {
  if (state.cloudEnabled) {
    await firebase.database().ref("challenges").set(state.challenges);
  }
  persistChallenges();
}

function initChallengeBoard() {
  const hasFirebaseConfig = firebaseConfig.apiKey && firebaseConfig.databaseURL;

  if (hasFirebaseConfig && window.firebase) {
    firebase.initializeApp(firebaseConfig);
    state.cloudEnabled = true;

    firebase.database().ref("challenges").on("value", (snap) => {
      state.challenges = snap.val() || [];
      persistChallenges();
      renderChallenges();
    });
  }

  els.challengeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const challenge = {
      team: document.getElementById("challengeTeam").value.trim(),
      sport: document.getElementById("challengeSport").value,
      date: document.getElementById("challengeDate").value,
      message: document.getElementById("challengeText").value.trim(),
      replies: [],
    };

    state.challenges.unshift(challenge);
    await saveChallenges();
    renderChallenges();
    els.challengeForm.reset();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEYS.challenges) {
      state.challenges = JSON.parse(localStorage.getItem(STORAGE_KEYS.challenges) || "[]");
      renderChallenges();
    }
  });

  renderChallenges();
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("kreeda_room_like_db", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("teams")) {
        db.createObjectStore("teams", { keyPath: "name" });
      }
      if (!db.objectStoreNames.contains("matches")) {
        db.createObjectStore("matches", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(storeName, mode = "readonly") {
  return state.db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addMatchResult(result) {
  await requestToPromise(tx("matches", "readwrite").add(result));
  await requestToPromise(tx("teams", "readwrite").put({ name: result.teamA }));
  await requestToPromise(tx("teams", "readwrite").put({ name: result.teamB }));
}

async function loadMatchResults() {
  state.scores = await requestToPromise(tx("matches").getAll());
  state.scores.reverse();
}

function renderScores() {
  els.scoreList.innerHTML = state.scores.length
    ? state.scores
        .map(
          (s) => `
        <article class="item">
          <h4>${s.teamA} vs ${s.teamB}</h4>
          <p><strong>Score:</strong> ${s.score}</p>
          <p><strong>Winner:</strong> ${s.winner}</p>
        </article>
      `,
        )
        .join("")
    : '<div class="item">No result posted yet.</div>';
}

async function initScoreWall() {
  state.db = await openDB();
  await loadMatchResults();
  renderScores();

  els.scoreForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const result = {
      teamA: document.getElementById("teamA").value.trim(),
      teamB: document.getElementById("teamB").value.trim(),
      score: document.getElementById("scoreLine").value.trim(),
      winner: document.getElementById("winner").value.trim(),
      postedAt: new Date().toISOString(),
    };

    await addMatchResult(result);
    await loadMatchResults();
    renderScores();
    els.scoreForm.reset();
  });
}

(async function init() {
  initBooking();
  initChallengeBoard();
  await initScoreWall();
})();

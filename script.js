/* HealthMonitor homepage script (vanilla JS) */
document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Render Lucide icons (guarded in case the CDN is blocked)
  if (window.lucide) lucide.createIcons();

  /* ---------- Sticky header shadow + active link ---------- */
  const header = $("#header");
  const links = $$(".nav-links a[href^='#']");
  const sections = links.map(a => $(a.getAttribute("href"))).filter(Boolean);
  const onScroll = () => {
    header.classList.toggle("scrolled", window.scrollY > 10);
    const y = window.scrollY + 120;
    let current = sections[0];
    sections.forEach(s => { if (s.offsetTop <= y) current = s; });
    links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + current.id));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const menuBtn = $("#menu-btn"), nav = $("#nav-links");
  const setMenu = open => {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
  };
  menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
  // Close the menu after tapping a link (smooth scrolling is handled by CSS)
  links.forEach(a => a.addEventListener("click", () => setMenu(false)));

  /* ---------- Scroll reveal ---------- */
  const reveal = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } });
  }, { threshold: 0.15 });
  $$(".reveal").forEach((el, i) => { el.style.transitionDelay = (i % 3) * 80 + "ms"; reveal.observe(el); });

  /* ---------- Animated counters ---------- */
  const animate = el => {
    const target = +el.dataset.count, suffix = el.dataset.suffix || "", dur = 1500, t0 = performance.now();
    const tick = now => {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const counters = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { animate(e.target); obs.unobserve(e.target); } });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach(el => counters.observe(el));

  /* ---------- Charts ---------- */
  let hrChart = null, bpChart = null;
  if (window.Chart) {
    const base = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: "#e8eef6" } } },
      elements: { line: { tension: 0.4 }, point: { radius: 3, hoverRadius: 6 } }
    };
    hrChart = new Chart($("#hrChart"), {
      type: "line",
      data: { labels: [], datasets: [{ label: "BPM", data: [],
        borderColor: "#f0566a", backgroundColor: "rgba(240,86,106,.12)", fill: true }] },
      options: { ...base, scales: { ...base.scales, y: { ...base.scales.y, suggestedMin: 60, suggestedMax: 90 } } }
    });
    bpChart = new Chart($("#bpChart"), {
      type: "line",
      data: { labels: [], datasets: [
        { label: "Systolic", data: [], borderColor: "#2d7ff9" },
        { label: "Diastolic", data: [], borderColor: "#34c38f" }] },
      options: { ...base, plugins: { legend: { display: true, position: "bottom" } },
        scales: { ...base.scales, y: { ...base.scales.y, suggestedMin: 60, suggestedMax: 140 } } }
    });
  }

  const setNote = (note, message, isError = false) => {
    note.textContent = message;
    note.style.color = isError ? "#c62d42" : "";
  };
  const formatDate = value => new Date(value).toLocaleString(undefined, {
    dateStyle: "medium", timeStyle: "short"
  });
  const renderDashboard = items => {
    const latest = items[0];
    $("#latest-hr").textContent = latest ? latest.hr : "—";
    $("#latest-bp").textContent = latest?.systolic && latest?.diastolic
      ? `${latest.systolic}/${latest.diastolic}` : "—";
    $("#latest-temp").textContent = latest ? Number(latest.temp).toFixed(1) : "—";
    $("#latest-spo2").textContent = latest ? Number(latest.spo2).toFixed(1) : "—";
    $("#dashboard-message").textContent = latest
      ? `Latest reading: ${formatDate(latest.recorded_at)}`
      : "No readings yet. Record your first reading below.";

    const recent = $("#recent-readings");
    recent.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("li");
      empty.textContent = "No readings recorded yet.";
      recent.append(empty);
    } else {
      items.slice(0, 3).forEach(item => {
        const row = document.createElement("li");
        const details = document.createElement("div");
        const title = document.createElement("b");
        const date = document.createElement("small");
        title.textContent = `Heart rate: ${item.hr} BPM · ${item.status}`;
        date.textContent = formatDate(item.recorded_at);
        details.append(title, date);
        row.append(details);
        recent.append(row);
      });
    }

    const chronological = [...items].reverse();
    const labels = chronological.map(item => new Date(item.recorded_at).toLocaleDateString());
    if (hrChart) {
      hrChart.data.labels = labels;
      hrChart.data.datasets[0].data = chronological.map(item => item.hr);
      hrChart.update();
    }
    if (bpChart) {
      bpChart.data.labels = labels;
      bpChart.data.datasets[0].data = chronological.map(item => item.systolic);
      bpChart.data.datasets[1].data = chronological.map(item => item.diastolic);
      bpChart.update();
    }
  };
  const refreshDashboard = async () => {
    const response = await window.HealthMonitorAPI.request("/history?limit=7");
    renderDashboard(response.items);
  };
  const setAuthenticated = async user => {
    $("#auth-email").textContent = user.email;
    $("#auth-email").hidden = false;
    $("#guest-actions").hidden = true;
    $("#logout-btn").hidden = false;
    $("#vitals-form").hidden = false;
    setNote($("#api-status"), `Signed in as ${user.email}.`);
    await refreshDashboard();
  };

  /* ---------- Modals (login / register navigation) ---------- */
  let lastFocus = null;
  const closeModals = () => {
    $$(".modal").forEach(m => m.hidden = true);
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  };
  const openModal = name => {
    const wasOpen = $$(".modal").some(m => !m.hidden);
    if (!wasOpen) lastFocus = document.activeElement;
    $$(".modal").forEach(m => m.hidden = true);
    const m = $("#modal-" + name);
    m.hidden = false;
    document.body.style.overflow = "hidden";
    setMenu(false);
    $("input", m).focus();
  };
  document.addEventListener("click", e => {
    const opener = e.target.closest("[data-open]");
    if (opener) return openModal(opener.dataset.open);
    if (e.target.closest("[data-close]") || e.target.classList.contains("modal")) closeModals();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModals(); });

  /* ---------- API-connected forms ---------- */
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const rules = {
    name: v => v.trim().length < 2 ? "Enter your name (at least 2 characters)." : "",
    email: v => !v.trim() ? "Enter your email address." : !emailRx.test(v) ? "Enter a valid email, like name@example.com." : "",
    password: v => v.length < 8 ? "Use at least 8 characters." : "",
    message: v => v.trim().length < 10 ? "Write a message of at least 10 characters." : ""
  };
  const setError = (input, msg) => {
    input.classList.toggle("invalid", !!msg);
    input.setAttribute("aria-invalid", !!msg);
    const error = input.parentElement.querySelector(".err");
    if (error) error.textContent = msg;
  };
  const check = (input, form) => {
    let msg = "";
    if (input.name === "confirm") {
      msg = input.value !== form.elements.password.value ? "Passwords do not match." : "";
    } else if (input.name === "password" && form.id === "login-form") {
      msg = input.value ? "" : "Enter your password.";
    } else if (rules[input.name]) msg = rules[input.name](input.value);
    setError(input, msg);
    return !msg;
  };
  const apiForms = {
    "contact-form": {
      path: "/contact",
      success: "Thanks! Your message has been received."
    },
    "login-form": { path: "/login", success: "Signed in successfully." },
    "register-form": { path: "/register", success: "Your account has been created." }
  };
  Object.keys(apiForms).forEach(id => {
    const form = $("#" + id);
    $$("input, textarea", form).forEach(i => i.addEventListener("blur", () => check(i, form)));
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const fields = $$("input, textarea", form);
      const ok = fields.map(i => check(i, form)).every(Boolean); // validate all, don't stop at first
      const note = $(".form-ok", form);
      if (!ok) { note.textContent = ""; fields.find(i => i.classList.contains("invalid")).focus(); return; }
      setNote(note, "Sending...");
      const values = Object.fromEntries(new FormData(form).entries());
      const payload = { name: values.name, email: values.email, message: values.message };
      if (id === "login-form") {
        delete payload.name;
        delete payload.message;
        payload.password = values.password;
      } else if (id === "register-form") {
        delete payload.message;
        payload.password = values.password;
      }

      try {
        const result = await window.HealthMonitorAPI.request(apiForms[id].path, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (id === "login-form" || id === "register-form") {
          window.HealthMonitorAPI.setToken(result.access_token);
          await setAuthenticated(result.user);
        }
        setNote(note, apiForms[id].success);
        form.reset();
      } catch (error) {
        setNote(note, error.message, true);
      }
    });
  });

  $("#vitals-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const note = $(".form-ok", form);
    const values = Object.fromEntries(new FormData(form).entries());
    const payload = {};
    ["hr", "spo2", "temp", "systolic", "diastolic", "resp"].forEach(key => {
      if (values[key] !== "") payload[key] = Number(values[key]);
    });
    setNote(note, "Saving reading...");
    try {
      await window.HealthMonitorAPI.request("/vitals", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      await refreshDashboard();
      setNote(note, "Reading saved.");
    } catch (error) {
      setNote(note, error.message, true);
    }
  });

  $("#logout-btn").addEventListener("click", async () => {
    const note = $("#api-status");
    try {
      await window.HealthMonitorAPI.request("/logout", { method: "POST" });
      window.HealthMonitorAPI.clearToken();
      $("#auth-email").hidden = true;
      $("#logout-btn").hidden = true;
      $("#guest-actions").hidden = false;
      $("#vitals-form").hidden = true;
      renderDashboard([]);
      setNote(note, "You have been signed out.");
    } catch (error) {
      setNote(note, error.message, true);
    }
  });

  const initializeApi = async () => {
    const note = $("#api-status");
    const token = window.HealthMonitorAPI.getToken();
    if (!token) {
      try {
        await window.HealthMonitorAPI.request("/health");
        if (!window.HealthMonitorAPI.getToken()) {
          setNote(note, "Backend connected. Sign in to view and save your readings.");
        }
      } catch (error) {
        setNote(note, error.message, true);
      }
      return;
    }
    try {
      const user = await window.HealthMonitorAPI.request("/me");
      await setAuthenticated(user);
      setNote(note, `Signed in as ${user.email}.`);
    } catch (error) {
      if (error.status === 401) window.HealthMonitorAPI.clearToken();
      $("#vitals-form").hidden = true;
      setNote(note, error.message, true);
    }
  };
  initializeApi();
});
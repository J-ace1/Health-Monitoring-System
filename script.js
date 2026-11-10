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

  /* ---------- Charts (Chart.js, sample data) ---------- */
  if (window.Chart) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const base = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: "#e8eef6" } } },
      elements: { line: { tension: 0.4 }, point: { radius: 3, hoverRadius: 6 } }
    };
    new Chart($("#hrChart"), {
      type: "line",
      data: { labels: days, datasets: [{ label: "BPM", data: [70, 74, 71, 78, 73, 69, 72],
        borderColor: "#f0566a", backgroundColor: "rgba(240,86,106,.12)", fill: true }] },
      options: { ...base, scales: { ...base.scales, y: { ...base.scales.y, suggestedMin: 60, suggestedMax: 90 } } }
    });
    new Chart($("#bpChart"), {
      type: "line",
      data: { labels: days, datasets: [
        { label: "Systolic", data: [118, 121, 119, 126, 122, 117, 118], borderColor: "#2d7ff9" },
        { label: "Diastolic", data: [76, 79, 77, 82, 78, 75, 76], borderColor: "#34c38f" }] },
      options: { ...base, plugins: { legend: { display: true, position: "bottom" } },
        scales: { ...base.scales, y: { ...base.scales.y, suggestedMin: 60, suggestedMax: 140 } } }
    });
  }

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

  /* ---------- Form validation ---------- */
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
    input.parentElement.querySelector(".err").textContent = msg;
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
  const messages = {
    "contact-form": "Thanks! We will reply within one business day.",
    "login-form": "Logged in (demo). Connect a backend to enable real sign-in.",
    "register-form": "Account created (demo). Connect a backend to save it."
  };
  $$(".form").forEach(form => {
    $$("input, textarea", form).forEach(i => i.addEventListener("blur", () => check(i, form)));
    form.addEventListener("submit", e => {
      e.preventDefault();
      const fields = $$("input, textarea", form);
      const ok = fields.map(i => check(i, form)).every(Boolean); // validate all, don't stop at first
      const note = $(".form-ok", form);
      if (!ok) { note.textContent = ""; fields.find(i => i.classList.contains("invalid")).focus(); return; }
      note.textContent = messages[form.id];
      form.reset();
      // Real app: window.location.href = "dashboard.html" after a successful login/registration
    });
  });
});
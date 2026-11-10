document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();

  const historyBody = document.getElementById("history-body");
  const clearBtn = document.getElementById("clear-history");
  const status = document.getElementById("history-status");
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const navMenu = document.getElementById("nav-menu");

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.style.color = isError ? "#ff4b4b" : "";
  };

  function showEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.style.cssText = "text-align:center; padding: 50px; color: var(--text-secondary);";
    cell.textContent = message;
    row.append(cell);
    historyBody.replaceChildren(row);
  }

  function renderHistory(entries) {
    if (!entries.length) {
      showEmpty("No readings saved yet. Record a reading on the Dashboard.");
      return;
    }

    const rows = entries.map(entry => {
      const row = document.createElement("tr");
      const dateCell = document.createElement("td");
      const date = document.createElement("span");
      const time = document.createElement("small");
      const heartRate = document.createElement("td");
      const oxygen = document.createElement("td");
      const respiratory = document.createElement("td");
      const recordedAt = new Date(entry.recorded_at);

      date.style.cssText = "font-weight: 600; color: var(--text-main);";
      date.textContent = recordedAt.toLocaleDateString();
      time.style.color = "var(--text-secondary)";
      time.textContent = recordedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      heartRate.textContent = `${entry.hr} BPM`;
      heartRate.style.cssText = "color: var(--accent-green); font-weight: bold;";
      oxygen.textContent = `${entry.spo2}%`;
      respiratory.textContent = entry.resp == null ? "—" : `${entry.resp} BrPM`;

      dateCell.append(date, document.createElement("br"), time);
      row.append(dateCell, heartRate, oxygen, respiratory);
      return row;
    });
    historyBody.replaceChildren(...rows);
  }

  async function loadHistory() {
    if (!window.HealthMonitorAPI.getToken()) {
      showEmpty("Sign in on the Dashboard to view your saved history.");
      setStatus("Your readings are private to your account. Sign in to load them.");
      return;
    }
    try {
      const response = await window.HealthMonitorAPI.request("/history?limit=500");
      renderHistory(response.items);
      setStatus(`${response.count} reading${response.count === 1 ? "" : "s"} loaded.`);
    } catch (error) {
      showEmpty(error.message);
      setStatus(error.message, true);
    }
  }

  clearBtn.addEventListener("click", async () => {
    if (!window.HealthMonitorAPI.getToken()) {
      setStatus("Sign in on the Dashboard before clearing history.", true);
      return;
    }
    if (!confirm("Delete all health history? This cannot be undone.")) return;
    clearBtn.disabled = true;
    try {
      const result = await window.HealthMonitorAPI.request("/history", { method: "DELETE" });
      await loadHistory();
      setStatus(`${result.deleted} reading${result.deleted === 1 ? "" : "s"} deleted.`);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      clearBtn.disabled = false;
    }
  });

  if (mobileBtn && navMenu) {
    mobileBtn.addEventListener("click", event => {
      event.stopPropagation();
      const isOpen = navMenu.classList.toggle("active");
      updateMenuIcon(isOpen);
    });
    navMenu.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("active");
        updateMenuIcon(false);
      });
    });
    document.addEventListener("click", event => {
      if (!navMenu.contains(event.target) && !mobileBtn.contains(event.target)) {
        navMenu.classList.remove("active");
        updateMenuIcon(false);
      }
    });
  }

  function updateMenuIcon(isOpen) {
    const icon = mobileBtn?.querySelector("i");
    if (icon && window.lucide) {
      icon.setAttribute("data-lucide", isOpen ? "x" : "menu");
      lucide.createIcons();
    }
  }

  loadHistory();
});

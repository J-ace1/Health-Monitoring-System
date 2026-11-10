(() => {
  const storageKey = "theme";
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem(storageKey) || "light";
  } catch {
    // Keep the default theme if browser storage is unavailable.
  }

  const applySavedTheme = () => {
    document.body.classList.toggle("light-mode", savedTheme === "light");
    document.body.classList.toggle("dark-mode", savedTheme === "dark");
  };
  if (document.body) {
    applySavedTheme();
  } else {
    document.addEventListener("DOMContentLoaded", applySavedTheme, { once: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("theme-toggle");
    const updateButton = () => {
      if (!button) return;
      const isLight = document.body.classList.contains("light-mode");
      const nextTheme = isLight ? "dark" : "light";
      button.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
      button.setAttribute("title", `Switch to ${nextTheme} mode`);
      button.setAttribute("aria-pressed", String(!isLight));
      const sun = button.querySelector(".sun-icon");
      const moon = button.querySelector(".moon-icon");
      if (sun && moon) {
        sun.hidden = isLight;
        moon.hidden = !isLight;
      }
    };

    updateButton();
    button?.addEventListener("click", () => {
      const isLight = document.body.classList.toggle("light-mode");
      document.body.classList.toggle("dark-mode", !isLight);
      try {
        localStorage.setItem(storageKey, isLight ? "light" : "dark");
      } catch {
        // The current page still changes theme when storage is unavailable.
      }
      updateButton();
    });
  });
})();

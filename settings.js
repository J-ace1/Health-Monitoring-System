document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();

  const form = document.getElementById("settings-form");
  const input = document.getElementById("max-hr");
  const status = document.getElementById("settings-status");
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const navMenu = document.getElementById("nav-menu");

  mobileBtn.addEventListener("click", () => navMenu.classList.toggle("active"));

  const showError = message => {
    status.style.color = "#ff4b4b";
    status.textContent = message;
  };
  form.addEventListener("submit", event => event.preventDefault());
  const token = window.HealthMonitorAPI.getToken();
  if (!token) {
    showError("Sign in on the Dashboard before changing account settings.");
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  window.HealthMonitorAPI.request("/settings")
    .then(settings => {
      input.value = settings.max_hr;
    })
    .catch(showError);

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.style.color = "";
    status.textContent = "Saving...";
    try {
      const result = await window.HealthMonitorAPI.request("/update_settings", {
        method: "POST",
        body: JSON.stringify({ max_hr: Number(input.value) })
      });
      status.textContent = `${result.message} Alert threshold: ${result.max_hr} BPM.`;
    } catch (error) {
      showError(error.message);
    } finally {
      button.disabled = false;
    }
  });
});

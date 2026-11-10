document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();

  const form = document.getElementById("contact-form");
  const status = document.getElementById("contact-status");
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const navMenu = document.getElementById("nav-menu");

  mobileBtn?.addEventListener("click", () => navMenu?.classList.toggle("active"));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.style.color = "";
    status.textContent = "Sending message...";
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const response = await window.HealthMonitorAPI.request("/contact", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      status.textContent = response.message;
    } catch (error) {
      status.style.color = "#ff4b4b";
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
});

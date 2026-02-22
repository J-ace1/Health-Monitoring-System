document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Initialize Icons ---
    if (window.lucide) lucide.createIcons();

    const historyBody = document.getElementById('history-body');
    const clearBtn = document.getElementById('clear-history');
    const themeBtn = document.getElementById('theme-toggle');
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');

    // --- 2. History Management Logic ---
    function loadHistory() {
        // Must match the key used in your main script exactly
        const rawData = localStorage.getItem('vitalAI_History');
        const history = JSON.parse(rawData) || [];
        
        if (history.length === 0) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding: 50px; color: var(--text-secondary);">
                        <i data-lucide="clipboard-x" style="margin-bottom:10px; width: 40px; height: 40px;"></i><br>
                        No scan history found. Start a scan on the Dashboard.
                    </td>
                </tr>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Generate Table Rows
        historyBody.innerHTML = history.map(entry => `
            <tr>
                <td>
                    <span style="font-weight: 600; color: var(--text-main);">${entry.date}</span><br>
                    <small style="color: var(--text-secondary);">${entry.time}</small>
                </td>
                <td><span style="color: var(--accent-green); font-weight: bold;">${entry.hr}</span> <small>BPM</small></td>
                <td>${entry.spo2}%</td>
                <td>${entry.resp} <small>BrPM</small></td>
            </tr>
        `).join('');
    }

    // Clear History Logic
    clearBtn?.addEventListener('click', () => {
        if (confirm("Delete all health history? This cannot be undone.")) {
            localStorage.removeItem('vitalAI_History');
            loadHistory();
        }
    });

    // --- 3. Persistent Theme Logic ---
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }

    themeBtn?.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });

    // --- 4. Mobile Menu Logic ---
    if (mobileBtn && navMenu) {
        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop click from bubbling to document
            const isOpen = navMenu.classList.toggle('active');
            
            // Toggle icon between Menu and X
            const icon = mobileBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
                lucide.createIcons(); 
            }
        });

        // Close menu when clicking any link
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                updateMenuIcon(false);
            });
        });

        // Close menu if clicking outside the navbar
        document.addEventListener('click', (e) => {
            if (!navMenu.contains(e.target) && !mobileBtn.contains(e.target)) {
                if (navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    updateMenuIcon(false);
                }
            }
        });
    }

    function updateMenuIcon(isOpen) {
        const icon = mobileBtn?.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
            lucide.createIcons();
        }
    }

    // Initialize History on load
    loadHistory();
});
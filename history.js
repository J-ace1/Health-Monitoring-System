document.addEventListener('DOMContentLoaded', () => {
    // Refresh Lucide icons
    if (window.lucide) lucide.createIcons();

    const historyBody = document.getElementById('history-body');
    const clearBtn = document.getElementById('clear-history');

    function loadHistory() {
        // Must match the key used in script.js exactly
        const rawData = localStorage.getItem('vitalAI_History');
        const history = JSON.parse(rawData) || [];
        
        if (history.length === 0) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding: 50px; color: #888;">
                        <i data-lucide="clipboard-x" style="margin-bottom:10px;"></i><br>
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
                    <span style="font-weight: 600;">${entry.date}</span><br>
                    <small style="color: #666;">${entry.time}</small>
                </td>
                <td><span class="text-accent">${entry.hr}</span> <small>BPM</small></td>
                <td>${entry.spo2}%</td>
                <td>${entry.resp} <small>BrPM</small></td>
            </tr>
        `).join('');
    }

    // Clear History Logic
    clearBtn?.addEventListener('click', () => {
        if (confirm("Delete all health history?")) {
            localStorage.removeItem('vitalAI_History');
            loadHistory();
        }
    });

    loadHistory();
});
// 1. Initialize the Chart
// Optimization: Check if the element exists first to avoid null errors
const canvas = document.getElementById('vitalChart');
if (!canvas) {
    console.error("Canvas element 'vitalChart' not found! Check your HTML.");
}

const ctx = canvas.getContext('2d');
let vitalChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Heart Rate (BPM)',
            borderColor: '#00ff88',
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            data: [],
            borderWidth: 2,
            tension: 0.4,
            fill: true
        }]
    },
    options: {
        responsive: true,
        animation: { duration: 500 }, // Smoother transitions
        scales: {
            x: { display: false },
            y: { 
                beginAtZero: false, 
                grid: { color: '#333' },
                ticks: { color: '#a0a0a0' }
            }
        },
        plugins: { legend: { display: false } }
    }
});

// 2. Function to Update the UI with Data
function updateUI(data) {
    // Optimization: Use optional chaining or check existence to prevent script crash
    const hrEl = document.getElementById('hr-value');
    const spo2El = document.getElementById('spo2-value');
    const tempEl = document.getElementById('temp-value');

    if (hrEl) hrEl.innerText = data.hr;
    if (spo2El) spo2El.innerText = data.spo2;
    if (tempEl) tempEl.innerText = data.temp;

    // Update AI Sidebar messages
    const aiContainer = document.getElementById('ai-messages');
    if (aiContainer) {
        const timeLabel = new Date().toLocaleTimeString();
        
        const msg = document.createElement('p');
        msg.className = 'ai-msg';
        msg.innerHTML = `<strong>${timeLabel}:</strong> ${data.status}`;
        
        aiContainer.prepend(msg);
        if (aiContainer.children.length > 3) {
            aiContainer.removeChild(aiContainer.lastChild);
        }
    }

    // Add data point to chart
    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (vitalChart.data.labels.length > 20) { // Increased to 20 for a better look
        vitalChart.data.labels.shift();
        vitalChart.data.datasets[0].data.shift();
    }
    vitalChart.data.labels.push(timeLabel);
    vitalChart.data.datasets[0].data.push(data.hr);
    vitalChart.update('none'); // 'none' improves performance for high-frequency updates
}

// 3. Main Function to Fetch from Backend
async function fetchData() {
    try {
        // NOTE: If you are on Ubuntu, ensure the backend is running on 127.0.0.1:8000
        const response = await fetch('http://127.0.0.1:8000/vitals');
        
        if (!response.ok) throw new Error("Backend Offline");
        
        const data = await response.json();
        updateUI(data);

        // Update connection dot if it exists
        const dot = document.getElementById('connection-dot');
        if (dot) dot.style.backgroundColor = '#00ff88';

    } catch (error) {
        console.warn("Could not connect to FastAPI:", error.message);
        const dot = document.getElementById('connection-dot');
        if (dot) dot.style.backgroundColor = 'red';
    }
}

// Start the loop: Fetch data every 1000ms (1 second)
setInterval(fetchData, 1000);
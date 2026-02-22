// --- VitalAI Full Integrated Dashboard & Bio-Sensor Logic ---

// 1. Global State
let isScanning = false;
let redHistory = [];
let blueHistory = [];
let pulseHistory = [];
let lastRedAverage = 0;

// 2. Initialize Chart.js
const canvas = document.getElementById('vitalChart');
const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
let vitalChart;

if (ctx) {
    vitalChart = new Chart(ctx, {
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
            animation: false, 
            scales: {
                x: { display: false },
                y: { min: 40, max: 180, grid: { color: '#333' }, ticks: { color: '#888' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// 3. Camera & Sensor Logic
const video = document.getElementById('vitals-video');
const canvasScan = document.getElementById('vitals-canvas');
const ctxScan = canvasScan ? canvasScan.getContext('2d', { willReadFrequently: true }) : null;

async function startCameraScan() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
            audio: false 
        });
        
        const dot = document.getElementById('connection-dot');
        const statusTxt = document.getElementById('status-text');
        if (dot) dot.style.backgroundColor = '#00ff88'; 
        if (statusTxt) statusTxt.innerText = "Camera Sensor Online";

        if (video) {
            video.srcObject = stream;
            isScanning = true;
            pulseHistory = [];
            redHistory = [];
            blueHistory = [];
            
            document.querySelector('.scanner-card').classList.add('scanning');
            document.getElementById('start-scan').innerText = "Analyzing Pulse...";
            requestAnimationFrame(analyzeFrame);
        }

        setTimeout(stopScan, 20000);
    } catch (err) {
        const dot = document.getElementById('connection-dot');
        const statusTxt = document.getElementById('status-text');
        if (dot) dot.style.backgroundColor = '#ff4b4b'; 
        if (statusTxt) statusTxt.innerText = "Sensor Error";
        alert("Camera error: Ensure you are using HTTPS.");
    }
}

function analyzeFrame() {
    if (!isScanning || !ctxScan || !video) return;

    ctxScan.drawImage(video, 0, 0, 100, 100);
    const frame = ctxScan.getImageData(0, 0, 100, 100);
    const data = frame.data;

    let rSum = 0, bSum = 0;
    for (let i = 0; i < data.length; i += 4) {
        rSum += data[i];     
        bSum += data[i + 2]; 
    }

    const rAvg = rSum / (data.length / 4);
    const bAvg = bSum / (data.length / 4);

    redHistory.push(rAvg);
    blueHistory.push(bAvg);

    if (lastRedAverage !== 0) {
        const delta = rAvg - lastRedAverage;
        if (delta > 0.15) { 
            const now = Date.now();
            pulseHistory.push(now);
            triggerPulseAnimation();
            calculateBPM();
        }
    }
    lastRedAverage = rAvg;

    if (redHistory.length % 100 === 0 && redHistory.length > 50) {
        calculateSecondaryVitals();
    }

    requestAnimationFrame(analyzeFrame);
}

// 4. Data Persistence (History Logic)
function saveScanToHistory() {
    const hr = document.getElementById('hr-value').innerText;
    const spo2 = document.getElementById('spo2-value').innerText;
    const resp = document.getElementById('resp-value').innerText;

    if (hr === "--" || hr === "0" || isNaN(parseInt(hr))) {
        console.log("History Save Skipped: No valid data found.");
        return;
    }

    const newEntry = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hr: hr,
        spo2: spo2,
        resp: resp
    };

    let history = JSON.parse(localStorage.getItem('vitalAI_History')) || [];
    history.unshift(newEntry);
    if (history.length > 50) history.pop();
    localStorage.setItem('vitalAI_History', JSON.stringify(history));
    console.log("Success: Scan saved to localStorage.", newEntry);
}

function downloadHealthReport() {
    const hr = document.getElementById('hr-value').innerText;
    const spo2 = document.getElementById('spo2-value').innerText;
    const resp = document.getElementById('resp-value').innerText;
    const status = document.getElementById('ai-status').innerText;
    const timestamp = new Date().toLocaleString();

    const reportContent = `
VitalAI - Health Summary Report
Generated on: ${timestamp}
---------------------------------
Heart Rate:     ${hr} BPM
Oxygen (SpO2):  ${spo2} %
Breathing Rate: ${resp} BrPM

AI Insight Summary:
${status}
---------------------------------
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `VitalAI_Report.txt`;
    link.click();
}

// 5. Mathematical Vital Calculations
function calculateBPM() {
    const now = Date.now();
    pulseHistory = pulseHistory.filter(t => now - t < 6000); 
    
    if (pulseHistory.length > 2) {
        const duration = (pulseHistory[pulseHistory.length - 1] - pulseHistory[0]) / 1000;
        const bpm = (pulseHistory.length / duration) * 60;
        if (bpm > 45 && bpm < 160) updateHeartRateUI(Math.round(bpm));
    }
}

function calculateSecondaryVitals() {
    const rAC = Math.max(...redHistory.slice(-100)) - Math.min(...redHistory.slice(-100));
    const rDC = redHistory.slice(-100).reduce((a, b) => a + b) / 100;
    const bAC = Math.max(...blueHistory.slice(-100)) - Math.min(...blueHistory.slice(-100));
    const bDC = blueHistory.slice(-100).reduce((a, b) => a + b) / 100;

    const ratio = (rAC / rDC) / (bAC / bDC);
    let spo2 = 110 - (20 * ratio); 
    spo2 = Math.min(100, Math.max(92, spo2)); 

    let crosses = 0;
    for (let i = 1; i < redHistory.length; i++) {
        if ((redHistory[i] > rDC && redHistory[i-1] <= rDC)) crosses++;
    }
    const respRate = Math.round((crosses / (redHistory.length / 30)) * 60);

    updateSecondaryUI(Math.round(spo2), respRate);
}

// 6. UI & Interaction Helpers
function triggerPulseAnimation() {
    const container = document.querySelector('.scanner-card');
    if(container) {
        container.classList.add('pulse-active');
        setTimeout(() => container.classList.remove('pulse-active'), 400);
    }
}

function updateHeartRateUI(bpm) {
    const hrEl = document.getElementById('hr-value');
    if (hrEl) hrEl.innerText = bpm;
    if (vitalChart) {
        vitalChart.data.labels.push(new Date().toLocaleTimeString());
        vitalChart.data.datasets[0].data.push(bpm);
        if (vitalChart.data.labels.length > 15) {
            vitalChart.data.labels.shift();
            vitalChart.data.datasets[0].data.shift();
        }
        vitalChart.update('none');
    }
}

function updateSecondaryUI(spo2, rr) {
    const spo2El = document.getElementById('spo2-value');
    if (spo2El) spo2El.innerText = spo2;
    
    const rrEl = document.getElementById('resp-value');
    if (rrEl) rrEl.innerText = rr;

    const aiStatus = document.getElementById('ai-status');
    if (aiStatus) {
        if (spo2 < 95) aiStatus.innerText = "Oxygen slightly low. Sit upright.";
        else aiStatus.innerText = "Vitals are stable and within healthy ranges.";
    }
}

function stopScan() {
    isScanning = false;
    document.querySelector('.scanner-card')?.classList.remove('scanning');
    document.getElementById('start-scan').innerText = "Start New Scan";
    saveScanToHistory();
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
}

// 7. Global Init
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // --- MOBILE NAVIGATION LOGIC ---
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');
    // Inside your mobileBtn click listener:
const isOpen = navMenu.classList.contains('active');
document.body.style.overflow = isOpen ? 'hidden' : 'auto';
    if (mobileBtn && navMenu) {
        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('active');
            
            // Toggle icon between menu and x
            const icon = mobileBtn.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.setAttribute('data-lucide', 'x');
            } else {
                icon.setAttribute('data-lucide', 'menu');
            }
            lucide.createIcons();
        });

        // Close menu if user clicks a link (needed for navigation to work)
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
            });
        });
    }

    // Standard Buttons
    document.getElementById('start-scan')?.addEventListener('click', startCameraScan);
    document.getElementById('download-report')?.addEventListener('click', downloadHealthReport);

    // Theme Logic
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    });
});
// --- VitalAI Integrated Camera & Dashboard Logic ---

// 1. Global Variables
let isScanning = false;
let heartRateData = [];
let lastRedAverage = 0;
let pulseHistory = [];

// 2. Initialize Chart.js
const canvas = document.getElementById('vitalChart');
const ctx = canvas ? canvas.getContext('2d') : null;
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
            animation: { duration: 0 },
            scales: {
                x: { display: false },
                y: { min: 40, max: 180, grid: { color: '#333' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// 3. Camera Pulse Detection Logic
const video = document.getElementById('vitals-video');
const canvasScan = document.getElementById('vitals-canvas');
const ctxScan = canvasScan ? canvasScan.getContext('2d', { willReadFrequently: true }) : null;

async function startCameraScan() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
            audio: false 
        });
        
        if (video) {
            video.srcObject = stream;
            isScanning = true;
            document.getElementById('start-scan').innerText = "Scanning Pulse...";
            requestAnimationFrame(analyzeFrame);
        }

        // Auto-stop after 20 seconds to calculate final BPM
        setTimeout(stopScan, 20000);
    } catch (err) {
        alert("Camera error: Please ensure you are on HTTPS and have granted camera permissions.");
    }
}

function analyzeFrame() {
    if (!isScanning || !ctxScan || !video) return;

    // Draw video frame to hidden canvas
    ctxScan.drawImage(video, 0, 0, 100, 100);
    const frame = ctxScan.getImageData(0, 0, 100, 100);
    const data = frame.data;

    let redSum = 0;
    // Calculate average "Redness" of the finger over the camera
    for (let i = 0; i < data.length; i += 4) {
        redSum += data[i];
    }
    const avgRed = redSum / (data.length / 4);

    // Detect a "Beat" (When redness dips slightly due to blood flow)
    if (lastRedAverage !== 0) {
        const delta = avgRed - lastRedAverage;
        if (delta > 0.15) { // Threshold for a pulse beat
            const now = Date.now();
            pulseHistory.push(now);
            if (pulseHistory.length > 2) {
                calculateBPM();
            }
        }
    }
    lastRedAverage = avgRed;
    requestAnimationFrame(analyzeFrame);
}

function calculateBPM() {
    // Keep only pulses from the last 5 seconds for a rolling average
    const now = Date.now();
    pulseHistory = pulseHistory.filter(t => now - t < 5000);
    
    if (pulseHistory.length > 2) {
        const duration = (pulseHistory[pulseHistory.length - 1] - pulseHistory[0]) / 1000;
        const bpm = (pulseHistory.length / duration) * 60;
        
        if (bpm > 40 && bpm < 180) {
            updateDashboardUI(Math.round(bpm));
        }
    }
}

function stopScan() {
    isScanning = false;
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    document.getElementById('start-scan').innerText = "Start New Scan";
}

// 4. UI Update Logic
function updateDashboardUI(bpm) {
    const hrEl = document.getElementById('hr-value');
    if (hrEl) hrEl.innerText = bpm;

    // Update Chart
    if (vitalChart) {
        const timeLabel = new Date().toLocaleTimeString();
        vitalChart.data.labels.push(timeLabel);
        vitalChart.data.datasets[0].data.push(bpm);

        if (vitalChart.data.labels.length > 15) {
            vitalChart.data.labels.shift();
            vitalChart.data.datasets[0].data.shift();
        }
        vitalChart.update('none');
    }
}



// 5. General Dashboard Interactions
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Start Scan Button
    document.getElementById('start-scan')?.addEventListener('click', startCameraScan);

    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');

    themeBtn?.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    });

    // Mobile Menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('nav-menu').classList.toggle('active');
    });
});
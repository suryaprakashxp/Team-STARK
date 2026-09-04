// =====================================================
// PharmaGuard AI - Premium Clinical Frontend
// =====================================================

const API_URL = '/api/check-interactions';

document.addEventListener('DOMContentLoaded', () => {
    // Core Elements
    const analyzeBtn = document.getElementById('analyzeBtn');
    const sampleBtn = document.getElementById('sampleBtn');
    const medicationsInput = document.getElementById('medications');
    const profileInput = document.getElementById('profile');
    
    // UI Containers
    const loadingUI = document.getElementById('loadingUI');
    const emptyStateUI = document.getElementById('emptyStateUI');
    const resultsWrapper = document.getElementById('resultsWrapper');
    const loadingText = document.getElementById('loadingText');
    
    // Steps
    const steps = [document.getElementById('step1'), document.getElementById('step2'), document.getElementById('step3')];

    // --- 1. Quick-Add Chip Logic ---
    document.querySelectorAll('.drug-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const drug = chip.getAttribute('data-drug');
            const current = medicationsInput.value.trim();
            if (current) {
                if (!current.toLowerCase().includes(drug.toLowerCase())) {
                    medicationsInput.value = `${current}, ${drug}`;
                }
            } else {
                medicationsInput.value = drug;
            }
            medicationsInput.focus();
        });
    });

    // --- 2. Fill Sample Case ---
    if (sampleBtn) {
        sampleBtn.addEventListener('click', () => {
            medicationsInput.value = "Warfarin, Aspirin, Lisinopril";
            profileInput.value = "72-year-old male with history of atrial fibrillation, hypertension, and CKD stage 3. Patient is at high risk for falls.";
            medicationsInput.classList.add('ring-2', 'ring-medical-teal');
            setTimeout(() => medicationsInput.classList.remove('ring-2', 'ring-medical-teal'), 1000);
        });
    }

    // --- 3. Export Actions ---
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('copyBtn').addEventListener('click', () => {
        const text = resultsWrapper.innerText;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = document.getElementById('copyBtn').innerHTML;
            document.getElementById('copyBtn').innerHTML = "✅ Copied!";
            setTimeout(() => document.getElementById('copyBtn').innerHTML = originalText, 2000);
        });
    });

    // --- 4. Analysis Logic ---
    analyzeBtn.addEventListener('click', async () => {
        const medications = medicationsInput.value.trim();
        const profile = profileInput.value.trim();

        if (!medications) {
            alert('Please enter at least one medication to begin analysis.');
            medicationsInput.focus();
            return;
        }

        const medicationList = medications.split(',').map(m => m.trim()).filter(m => m !== '');

        // Pre-analysis UI state
        emptyStateUI.classList.add('hidden');
        resultsWrapper.classList.add('hidden');
        loadingUI.classList.remove('hidden');
        analyzeBtn.disabled = true;

        // Step Progression Simulation
        updateStep(0, "Consulting RxNorm database...");
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    medications: medicationList, 
                    profile: profile 
                })
            });

            updateStep(1, "Analyzing interactions with Gemini 2.0...");
            
            if (!response.ok) throw new Error(`Server Error: ${response.status}`);

            const data = await response.json();
            
            updateStep(2, "Finalizing clinical report...");
            
            setTimeout(() => {
                displayReport(data, profile, medicationList);
                loadingUI.classList.add('hidden');
                resultsWrapper.classList.remove('hidden');
            }, 600);

        } catch (error) {
            console.error('Analysis Fault:', error);
            showErrorState(profile);
        } finally {
            analyzeBtn.disabled = false;
        }
    });

    function updateStep(index, text) {
        loadingText.textContent = text;
        steps.forEach((s, idx) => {
            if (idx <= index) s.classList.add('active');
            else s.classList.remove('active');
        });
    }

    // Enter key shortcut
    medicationsInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') analyzeBtn.click();
    });
});

function displayReport(data, profile, medications) {
    const report = (typeof data.report === 'string') ? data.report : JSON.stringify(data.report || '');
    const hasInteractions = report.includes('Interactions Found') && !report.includes('No interactions found');
    
    // Extract metadata
    const interactionMatch = report.match(/\*\*Pair:\*\* ([^\n]+)/);
    const severityMatch = report.match(/\*\*Severity:\*\* ([^\n]+)/);
    const mechanismMatch = report.match(/\*\*Mechanism:\*\* ([^\n]+)/);

    const drugPair = interactionMatch ? interactionMatch[1] : medications.join(' ✦ ');
    const severity = severityMatch ? severityMatch[1].trim() : (hasInteractions ? 'High' : 'Low');
    const mechanism = mechanismMatch ? mechanismMatch[1] : 'No significant mechanisms identified.';
    
    // ── 1. Patient Context ──
    const patientProfileUI = document.getElementById('patientProfileUI');
    patientProfileUI.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-xl">👤</span>
            <div>
                <h4 class="text-[11px] font-bold text-medical-blue uppercase tracking-widest mb-1">Clinical Context</h4>
                <p class="text-sm text-slate-700 font-medium">${profile || 'Standard healthy profile'}</p>
                <div class="flex flex-wrap gap-1 mt-2">
                    ${medications.map(m => `<span class="bg-gray-100 text-[10px] px-2 py-0.5 rounded border border-gray-200">${m}</span>`).join('')}
                </div>
            </div>
        </div>
    `;

    // ── 2. Interactions UI ──
    const interactionsUI = document.getElementById('interactionsUI');
    const sevLower = severity.toLowerCase();
    
    // Theme Logic
    let cardClass = "sev-safe";
    let badgeClass = "bg-emerald-100 text-emerald-700";
    let badgeLabel = "🟢 SAFE / MINOR";
    let pulseClass = "";

    if (sevLower.includes("high") || sevLower.includes("major")) {
        const isContra = report.toLowerCase().includes("contraindicated");
        cardClass = "sev-high";
        badgeClass = "bg-red-100 text-red-700";
        badgeLabel = isContra ? "🔴 CONTRAINDICATED" : "🔴 MAJOR RISK";
        if (isContra) pulseClass = "animate-pulse-red";
    } else if (sevLower.includes("moderate")) {
        cardClass = "sev-mod";
        badgeClass = "bg-amber-100 text-amber-700";
        badgeLabel = "🟠 MODERATE RISK";
    }

    interactionsUI.innerHTML = `
        <div class="medical-card severity-card ${cardClass} p-5 transition-all">
            <div class="flex items-center justify-between mb-4">
                <span class="text-[10px] font-bold px-2 py-1 rounded-full ${badgeClass} ${pulseClass} uppercase tracking-tighter">
                    ${badgeLabel}
                </span>
                <span class="text-[10px] text-cool-gray font-bold">DEVICE-ID: RX-${Math.floor(Math.random()*9000)+1000}</span>
            </div>
            
            <h3 class="text-lg font-bold text-slate-800 mb-3">${drugPair}</h3>
            
            <div class="bg-white/60 rounded-lg p-4 border border-gray-100 shadow-inner">
                <h5 class="text-[10px] font-bold text-cool-gray uppercase mb-2">Pharmacological Pathway</h5>
                <p class="text-sm text-slate-600 leading-relaxed">${mechanism}</p>
            </div>
        </div>
    `;

    // ── 3. Clinical Guidance ──
    const guidanceUI = document.getElementById('guidanceUI');
    const guidanceText = extractClinicalAdvice(report, profile);
    
    guidanceUI.innerHTML = `
        <div class="bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-4">
                <span class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">💡</span>
                <h4 class="text-sm font-bold text-medical-blue uppercase tracking-widest">Clinician Guidance</h4>
            </div>
            <p class="text-sm text-slate-700 leading-relaxed font-medium">
                ${guidanceText}
            </p>
        </div>
    `;

    document.getElementById('reportTimestampDisplay').textContent = `ID# ${Date.now().toString().slice(-8)} • GEN AT ${new Date().toLocaleTimeString()}`;
}

function extractClinicalAdvice(report, profile) {
    const lines = report.split('\n');
    let advice = '';
    let inSection = false;
    for (const line of lines) {
        if (line.includes('Clinical Guidance')) { inSection = true; continue; }
        if (inSection && line.trim() && !line.includes('**')) { advice = line.trim(); break; }
    }
    if (advice) return advice;
    return "Consult with a licensed medical professional before adjusting medications. Regular monitoring of vital signs and symptoms is required for this pharmacological profile.";
}

function showErrorState(context) {
    const emptyStateUI = document.getElementById('emptyStateUI');
    emptyStateUI.classList.remove('hidden');
    emptyStateUI.innerHTML = `
        <div class="text-red-600 p-8">
            <span class="text-4xl mb-4 block">⚠️</span>
            <h3 class="text-lg font-bold mb-2">Network Connection Fault</h3>
            <p class="text-sm opacity-80 mb-4">PharmaGuard was unable to establish a secure link with the RxNorm database or Gemini AI.</p>
            <button onclick="location.reload()" class="btn-outline px-6 py-2 text-xs">Re-establish Connection</button>
        </div>
    `;
    document.getElementById('loadingUI').classList.add('hidden');
}

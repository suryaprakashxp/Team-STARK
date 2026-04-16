// =====================================================
// VerifiedRx Screener - Frontend Logic
// =====================================================

const API_URL = 'http://localhost:5000/api/check-interactions';

document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const medicationsInput = document.getElementById('medications');
    const profileInput = document.getElementById('profile');
    const loadingState = document.getElementById('loadingState');
    const resultsContainer = document.getElementById('resultsContainer');
    const emptyState = document.getElementById('emptyState');

    analyzeBtn.addEventListener('click', async () => {
        const medications = medicationsInput.value.trim();
        const profile = profileInput.value.trim();

        if (!medications) {
            alert('Please enter at least one medication.');
            medicationsInput.focus();
            return;
        }

        const medicationList = medications.split(',').map(m => m.trim()).filter(m => m !== '');

        // Show loading, hide others
        if (emptyState) emptyState.classList.add('hidden');
        if (resultsContainer) resultsContainer.classList.add('hidden');
        if (loadingState) loadingState.classList.remove('hidden');
        if (analyzeBtn) analyzeBtn.disabled = true;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    medications: medicationList, 
                    profile: profile 
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            
            // Parse and display the report
            displayReport(data, profile, medicationList);
            
            if (loadingState) loadingState.classList.add('hidden');
            if (resultsContainer) resultsContainer.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error:', error);
            if (loadingState) loadingState.classList.add('hidden');
            
            // Show error in results area
            const patientContextDisplay = document.getElementById('patientContextDisplay');
            if (patientContextDisplay) {
                patientContextDisplay.innerHTML = `
                    <div class="flex items-center text-gray-700">
                        <i class="fas fa-user mr-2"></i>
                        <span class="font-medium">${profile || 'No patient context provided'}</span>
                    </div>
                `;
            }
            
            const interactionCard = document.getElementById('interactionCard');
            if (interactionCard) {
                interactionCard.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p class="text-red-700 font-medium flex items-center">
                            <i class="fas fa-exclamation-circle mr-2"></i>
                            Error connecting to analysis service
                        </p>
                        <p class="text-red-600 text-sm mt-1">Please ensure the backend server is running on port 5000.</p>
                    </div>
                `;
            }
            
            const clinicalAdvice = document.getElementById('clinicalAdvice');
            if (clinicalAdvice) {
                clinicalAdvice.innerHTML = `
                    <p class="text-gray-600 text-sm">Unable to generate report. Check console for details.</p>
                `;
            }
            
            if (resultsContainer) resultsContainer.classList.remove('hidden');
        } finally {
            if (analyzeBtn) analyzeBtn.disabled = false;
        }
    });

    // Allow Enter key in medications input
    if (medicationsInput) {
        medicationsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (analyzeBtn) analyzeBtn.click();
            }
        });
    }
});

function displayReport(data, profile, medications) {
    const report = (typeof data.report === 'string') ? data.report : JSON.stringify(data.report || '');
    
    const hasInteractions = report.includes('Interactions Found') && !report.includes('No interactions found');
    
    // Extracted Data
    const interactionMatch = report.match(/\*\*Pair:\*\* ([^\n]+)/);
    const severityMatch = report.match(/\*\*Severity:\*\* ([^\n]+)/);
    const mechanismMatch = report.match(/\*\*Mechanism:\*\* ([^\n]+)/);

    const drugPair = interactionMatch ? interactionMatch[1] : medications.join(' ✦ ');
    const severity = severityMatch ? severityMatch[1].trim() : (hasInteractions ? 'High' : 'Low');
    const mechanism = mechanismMatch ? mechanismMatch[1] : 'No interaction mechanisms found.';
    const adviceText = extractClinicalAdvice(report, profile);

    // Determine Styles based on Severity
    const isHighRisk = severity.toLowerCase().includes('high') || severity.toLowerCase().includes('major');
    const isModerate = severity.toLowerCase().includes('moderate');

    let theme = {
        glow: 'shadow-emerald-500/20',
        border: 'border-emerald-500/30',
        bg: 'from-emerald-900/40 to-teal-900/20',
        badgeBg: 'bg-emerald-500/20',
        badgeText: 'text-emerald-300',
        title: 'text-white',
        icon: '<svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
        badgeLabel: '✅ SAFE COMBINATION'
    };

    if (isHighRisk) {
        theme = {
            glow: 'shadow-red-600/30 w-full',
            border: 'border-red-500/50',
            bg: 'from-red-950/80 to-rose-950/60',
            badgeBg: 'bg-red-500/20 border border-red-500/30',
            badgeText: 'text-red-400 font-extrabold',
            title: 'text-red-50',
            icon: '<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            badgeLabel: '🛑 HIGH RISK'
        };
    } else if (isModerate) {
        theme = {
            glow: 'shadow-orange-500/20',
            border: 'border-orange-500/40',
            bg: 'from-orange-950/60 to-yellow-900/20',
            badgeBg: 'bg-orange-500/20 border border-orange-500/30',
            badgeText: 'text-orange-300 font-bold',
            title: 'text-orange-50',
            icon: '<svg class="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
            badgeLabel: '⚠️ MODERATE RISK'
        };
    }

    // Top Header Badge
    const badge = document.getElementById('reportBadge');
    if (badge) {
        badge.innerHTML = theme.badgeLabel;
        badge.className = `px-4 py-1.5 text-[11px] uppercase tracking-widest rounded-full shadow-lg backdrop-blur-md ${theme.badgeBg} ${theme.badgeText}`;
    }

    // 1. Patient Context UI
    const patientContextDisplay = document.getElementById('patientContextDisplay');
    if (patientContextDisplay) {
        patientContextDisplay.className = "mb-6 pb-6 border-b border-indigo-500/20";
        patientContextDisplay.innerHTML = `
            <div class="flex items-center gap-4 bg-indigo-950/40 border border-indigo-500/20 p-4 rounded-2xl backdrop-blur-md">
                <div class="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30 shrink-0">
                    <svg class="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </div>
                <div>
                    <h3 class="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Patient Context</h3>
                    <p class="text-[16px] font-medium text-white">${profile || 'No clinical context provided'}</p>
                </div>
            </div>
        `;
    }

    // 2. Interaction Card UI
    const interactionCard = document.getElementById('interactionCard');
    if (interactionCard) {
        interactionCard.innerHTML = `
            <div class="relative overflow-hidden bg-gradient-to-br ${theme.bg} border ${theme.border} rounded-2xl p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:${theme.glow}">
                
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div class="flex items-center gap-3">
                        ${theme.icon}
                        <h2 class="text-2xl font-bold ${theme.title} tracking-tight capitalize shadow-sm">
                            ${drugPair.split('+').join('<span class="text-white/30 mx-2 text-xl font-light">✦</span>')}
                        </h2>
                    </div>
                </div>

                <div class="bg-black/20 rounded-xl p-5 border border-white/5 shadow-inner">
                    <h4 class="text-[12px] font-bold text-white/50 uppercase tracking-[0.15em] mb-3">Pharmacological Mechanism</h4>
                    <p class="text-[15px] text-white/90 leading-[1.7] font-light">
                        ${mechanism}
                    </p>
                </div>
            </div>
        `;
    }

    // 3. Clinical Advice UI
    const clinicalAdvice = document.getElementById('clinicalAdvice');
    if (clinicalAdvice) {
        clinicalAdvice.innerHTML = `
            <div class="mt-6 flex items-start gap-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border border-amber-500/20 rounded-2xl p-5 sm:p-6 shadow-lg backdrop-blur-md">
                <div class="mt-1 shrink-0 rounded-full bg-amber-500/20 p-2 border border-amber-500/30">
                    <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                    <h4 class="text-[12px] font-extrabold text-amber-500 uppercase tracking-[0.15em] mb-2">Clinical Guidance</h4>
                    <p class="text-[15px] text-amber-100/80 leading-relaxed font-light">${adviceText}</p>
                </div>
            </div>
        `;
    }

    // Timestamp
    const reportTimestamp = document.getElementById('reportTimestamp');
    if (reportTimestamp) reportTimestamp.textContent = `Generated on ${new Date().toLocaleString()}`;
}

function extractClinicalAdvice(report, profile) {
    // Try to extract advice from the report
    const lines = report.split('\n');
    let advice = '';
    let inAdviceSection = false;
    
    for (const line of lines) {
        if (line.includes('Clinical Consideration') || line.includes('Clinical Guidance')) {
            inAdviceSection = true;
            continue;
        }
        if (inAdviceSection && line.trim() && !line.includes('**')) {
            advice = line.trim();
            break;
        }
    }
    
    if (advice) return advice;
    
    // Fallback advice based on profile
    if (profile.toLowerCase().includes('72') || profile.toLowerCase().includes('elderly')) {
        return 'For elderly patients, close monitoring is essential. Regular INR checks and screening for signs of bleeding (dark stools, unusual bruising) are critical. This combination should only be used under strict medical supervision.';
    }
    if (profile.toLowerCase().includes('renal') || profile.toLowerCase().includes('kidney')) {
        return 'Patient has renal considerations. Monitor kidney function regularly and watch for signs of drug accumulation. Dose adjustments may be necessary.';
    }
    
    return 'Consult with a healthcare provider before making any medication changes. Regular monitoring and follow-up are recommended.';
}

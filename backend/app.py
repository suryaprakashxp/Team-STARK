import os
import functools
import requests
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
# Forcing reload to pick up new API key
from dotenv import load_dotenv, dotenv_values
from google import genai
from google.genai import types as genai_types

# ── Flask app setup ─────────────────────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

# The client is now initialized dynamically inside generate_report()
# to support hourly token updates without restarts.


# ═══════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/")
def serve_index():
    """Serve the frontend index.html."""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/health", methods=["GET"])
def health():
    """Simple health-check endpoint."""
    return jsonify({"status": "OK"})


# ═══════════════════════════════════════════════════════════════════════════
# STEP 2 — RxNorm helpers
# ═══════════════════════════════════════════════════════════════════════════

RXNAV_BASE = "https://rxnav.nlm.nih.gov/REST"


@functools.lru_cache(maxsize=128)
def get_rxcui(drug_name: str) -> str | None:
    """
    Look up the first RxCUI for a drug name from the RxNorm API.
    Returns the RXCUI string or None if not found.
    """
    url = f"{RXNAV_BASE}/rxcui.json"
    try:
        resp = requests.get(url, params={"name": drug_name}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        id_group = data.get("idGroup", {})
        rxcui_list = id_group.get("rxnormId", [])
        return rxcui_list[0] if rxcui_list else None
    except Exception as exc:
        app.logger.warning("get_rxcui(%s) failed: %s", drug_name, exc)
        return None


# ═══════════════════════════════════════════════════════════════════════════
# STEP 3 — Gemini report generation (AI-Powered Interaction Check)
# ═══════════════════════════════════════════════════════════════════════════

def generate_report(medications: list[str], patient_context: str) -> dict:
    """
    Ask Gemini to identify drug-drug interactions and output a markdown string 
    compatible with the frontend regex parsers.
    """
    # Fetch key fresh from the file every time so we don't need to restart the Flask server!
    env_dict = dotenv_values(".env")
    api_key = env_dict.get("GEMINI_API_KEY")
    
    if not api_key:
        return "Error: No GEMINI_API_KEY found in backend/.env file."
        
    client = genai.Client(api_key=api_key)
    
    drugs_list = ", ".join(medications)
    
    prompt = f"""You are a clinical pharmacist. Identify and explain drug interactions between these medications:
    
Medications: {drugs_list}
Patient Context: {patient_context}

Format your response EXACTLY as follows. If there are interactions, begin with "Interactions Found".

If interactions exist:
Interactions Found
**Pair:** [Drug A] + [Drug B]
**Severity:** [High / Moderate / Low]
**Mechanism:** [Explain WHY it's risky in simple terms]

Clinical Guidance:
[Provide clinical advice emphasizing risks for this patient context]

If NO interactions exist:
No interactions found
**Pair:** {drugs_list}
**Severity:** Low
**Mechanism:** No significant clinical interactions detected between these medications.

Clinical Guidance:
[Provide standard advice like consult doctor before changes.]
"""

    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=prompt,
        config=genai_types.GenerateContentConfig(temperature=0.1),
    )
    
    return response.text


# ═══════════════════════════════════════════════════════════════════════════
# STEP 4 — Main API endpoint
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/api/check-interactions", methods=["POST"])
def check_interactions():
    """
    POST /api/check-interactions
    Body: {"medications": ["drug1", "drug2", ...], "profile": "patient context"}
    Returns: {"report": "<generated report text>"}
    """
    body = request.get_json(force=True, silent=True) or {}
    medications: list[str] = body.get("medications", [])
    profile: str = body.get("profile", "No patient context provided")

    if not medications or len(medications) < 1:
        return jsonify({"error": "Provide at least one medication."}), 400

    # Resolve RxCUIs in parallel for maximum speed
    resolved_data = [] # List of tuples: (original_name, rxcui_or_none)
    unique_meds = list(set([m.strip() for m in medications if m.strip()]))
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(get_rxcui, unique_meds))
    
    valid_drugs = []
    unresolved = []
    
    for drug, rxcui in zip(unique_meds, results):
        if rxcui:
            valid_drugs.append(drug)
        else:
            unresolved.append(drug)

    # Build context note for unresolved drugs
    context = profile
    if unresolved:
        context += f"\n[Note: Could not verify RxNorm IDs for: {', '.join(unresolved)}]"

    # Generate Gemini report using the verified drug names
    try:
        # We pass only unique drugs to Gemini to keep it fast
        report = generate_report(unique_meds, context)
    except Exception as exc:
        app.logger.error("Gemini generation error: %s", exc)
        return jsonify({"error": f"Report generation failed: {exc}"}), 500

    return jsonify({"report": report})


# ═══════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    app.run(debug=True, port=5000)

"""
Ollama Client + Smart Rule-Based Fallback Engine
=================================================
When Ollama is offline OR no model is installed, the rule-based engine
produces FULL analysis — Technical, Executive, and Beginner sections —
by analysing the actual parsed event data from the prompt.

No model download required. Works 100% offline.
"""
import asyncio
import json
import logging
from typing import AsyncGenerator, Optional
import httpx

logger = logging.getLogger("soc_dashboard.ollama")

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL   = "llama3"
TIMEOUT         = 120
STATUS_TIMEOUT  = 3

SYSTEM_ROLE = """You are a senior cybersecurity analyst and incident responder.
Explain security events clearly for technical analysts, managers, and beginners.
Base analysis ONLY on provided evidence. Never invent facts."""

AVAILABLE_MODELS = [
    {"id": "llama3",  "name": "Llama 3",  "description": "Meta Llama 3 — best reasoning"},
    {"id": "mistral", "name": "Mistral",  "description": "Mistral 7B — fast"},
    {"id": "qwen",    "name": "Qwen",     "description": "Alibaba Qwen — multilingual"},
    {"id": "gemma2",  "name": "Gemma 2",  "description": "Google Gemma — lightweight"},
    {"id": "phi3",    "name": "Phi-3",    "description": "Microsoft Phi-3 — small"},
]


async def check_ollama_status() -> dict:
    try:
        async with httpx.AsyncClient(timeout=STATUS_TIMEOUT) as client:
            r = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if r.status_code == 200:
                data = r.json()
                installed = [m["name"].split(":")[0] for m in data.get("models", [])]
                return {"running": True, "installed_models": installed}
    except Exception:
        pass
    return {"running": False, "installed_models": []}


async def generate(
    prompt: str,
    system: str = "",
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
) -> str:
    # First check if Ollama is running AND has a model installed
    status = await check_ollama_status()
    if status["running"] and status["installed_models"]:
        # Try actual Ollama
        payload = {
            "model":  model if model in status["installed_models"] else status["installed_models"][0],
            "prompt": prompt,
            "system": system,
            "stream": False,
            "options": {"temperature": temperature, "num_predict": 2048},
        }
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                r = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
                r.raise_for_status()
                return r.json().get("response", "").strip()
        except Exception as exc:
            logger.warning("Ollama request failed: %s — using smart fallback", exc)

    # Use smart rule-based engine
    return _smart_fallback(prompt)


async def generate_stream(
    prompt: str,
    system: str = "",
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
) -> AsyncGenerator[str, None]:
    result = await generate(prompt, system, model, temperature)
    # Stream it word by word so UI feels responsive
    words = result.split(" ")
    for i, word in enumerate(words):
        yield word + (" " if i < len(words) - 1 else "")
        await asyncio.sleep(0.01)


# ══════════════════════════════════════════════════════════════════════════════
# SMART RULE-BASED ANALYSIS ENGINE
# Produces full Technical + Executive + Beginner analysis from parsed events
# ══════════════════════════════════════════════════════════════════════════════

# Attack knowledge base
_ATTACK_KB = {
    "port_scan": {
        "technical": (
            "Network reconnaissance detected. A host performed systematic TCP/UDP port scanning "
            "against one or more target systems to enumerate open services and running applications. "
            "This activity is consistent with the Discovery phase of the MITRE ATT&CK framework "
            "(T1046 — Network Service Discovery). Port scanning precedes exploitation by allowing "
            "attackers to identify vulnerable service versions and accessible entry points. "
            "The scanning pattern suggests automated tooling (Nmap, Masscan, or similar)."
        ),
        "executive": (
            "An external system was caught mapping our network to find potential weaknesses. "
            "No systems have been breached yet, but this is a strong early warning sign that "
            "an attacker is preparing for a more serious attack. Immediate firewall review "
            "and increased monitoring are recommended."
        ),
        "beginner": (
            "Imagine a burglar walking down your street trying every door and window handle "
            "to see which ones are unlocked. That is exactly what happened here — an attacker "
            "checked which 'doors' (network ports) on our systems were open before deciding "
            "where to try to break in. This is usually the first step before a real attack."
        ),
        "story_phase": "Reconnaissance",
        "risk": "Medium — Indicates planned attack activity. No breach yet but warrants immediate monitoring.",
    },
    "brute_force": {
        "technical": (
            "Credential brute-force attack detected. An automated process submitted a high volume "
            "of authentication attempts against one or more accounts, consistent with dictionary "
            "attack or credential stuffing (MITRE T1110). The attack targets authentication "
            "endpoints and exploits weak or commonly used passwords. If any attempt succeeded, "
            "the affected account should be considered compromised and investigated immediately."
        ),
        "executive": (
            "An attacker repeatedly tried to guess login passwords for our systems, submitting "
            "hundreds or thousands of attempts automatically. If one attempt succeeded, the attacker "
            "would have full access to that account. Multi-factor authentication should be enabled "
            "immediately on all accounts."
        ),
        "beginner": (
            "Imagine someone at your front door trying every key on a huge keyring, one by one, "
            "hoping one will open the lock. That is what a brute force attack is — a computer "
            "programme tried thousands of different passwords very quickly, hoping one would work. "
            "The solution is to add a second lock (two-factor authentication) so even the right "
            "password alone is not enough."
        ),
        "story_phase": "Credential Access",
        "risk": "High — Repeated authentication failures indicate active credential attack. MFA required immediately.",
    },
    "ssh_brute": {
        "technical": (
            "SSH brute-force attack detected targeting remote access services. High-frequency "
            "authentication failures against SSH (port 22) indicate automated credential guessing "
            "or stuffing (MITRE T1110.004). SSH access represents a high-value target as successful "
            "compromise provides full command-line access to the target system. Recommend immediate "
            "implementation of key-based authentication and fail2ban rate limiting."
        ),
        "executive": (
            "Attackers are trying to break into our remote administration system (SSH) by "
            "repeatedly guessing passwords. This is a serious threat — if successful, the attacker "
            "would gain complete control of the server. Password-based SSH login should be "
            "disabled immediately in favour of cryptographic key authentication."
        ),
        "beginner": (
            "SSH is like a special remote control that lets administrators manage computers "
            "from anywhere. An attacker discovered this remote control exists and is trying "
            "every possible password code to activate it. We need to switch from a password "
            "system to a special digital key that cannot be guessed."
        ),
        "story_phase": "Credential Access",
        "risk": "High — SSH compromise grants full system access. Immediate key-based auth migration required.",
    },
    "malware": {
        "technical": (
            "Malware execution or signature match detected on a monitored endpoint. The detection "
            "indicates presence of malicious code capable of system compromise (MITRE T1059). "
            "Immediate host isolation is required to prevent lateral movement or data exfiltration. "
            "Forensic analysis of running processes, network connections, persistence mechanisms "
            "(scheduled tasks, registry run keys, startup items), and recently modified files "
            "should be performed before remediation."
        ),
        "executive": (
            "Malicious software has been detected on one of our systems. This is a serious "
            "incident — the malware could be stealing data, spying on activity, or preparing "
            "to spread to other systems. The affected device should be disconnected from the "
            "network immediately and investigated by the security team."
        ),
        "beginner": (
            "Malware is harmful software that sneaks onto a computer without permission — "
            "think of it like a spy hidden inside your house. It can steal your private "
            "information, watch what you type, or even let attackers control your computer "
            "remotely. The affected computer needs to be unplugged from the network right "
            "away before it can spread or cause more damage."
        ),
        "story_phase": "Execution",
        "risk": "Critical — Active malware on endpoint. Immediate isolation and forensic investigation required.",
    },
    "data_exfil": {
        "technical": (
            "Data exfiltration activity detected. Anomalous outbound data transfer patterns "
            "suggest sensitive data is being transferred to an external destination (MITRE T1041). "
            "The exfiltration may occur over standard protocols (HTTP/HTTPS) to blend with "
            "legitimate traffic. Immediate outbound connection blocking to identified destination "
            "IPs, DLP policy review, and data access audit are required."
        ),
        "executive": (
            "Our systems appear to be sending data to an unauthorised external location. "
            "This could mean an attacker is stealing confidential company data, customer "
            "records, or intellectual property. This is a potential data breach requiring "
            "immediate containment and possible regulatory notification."
        ),
        "beginner": (
            "Imagine discovering that someone in your office has been secretly photocopying "
            "private documents and mailing them to an unknown address. That is what data "
            "exfiltration means — our computer was secretly sending private information "
            "to the attacker's server. We need to find out what was taken and stop it immediately."
        ),
        "story_phase": "Exfiltration",
        "risk": "Critical — Active data exfiltration in progress. Immediate containment and breach assessment required.",
    },
    "ddos": {
        "technical": (
            "Distributed Denial of Service (DDoS) attack detected. High-volume traffic flood "
            "targeting network infrastructure or application layer (MITRE T1498). The attack "
            "consumes available bandwidth or server resources, rendering services unavailable "
            "to legitimate users. Upstream scrubbing, rate limiting, and ISP-level mitigation "
            "should be engaged immediately."
        ),
        "executive": (
            "Our systems are being flooded with fake traffic to make our services unavailable "
            "to real customers. This is like jamming a phone line so no real calls can get "
            "through. Customer-facing services may be experiencing outages. "
            "Our internet provider needs to be contacted immediately to help filter the attack traffic."
        ),
        "beginner": (
            "A DDoS attack is like thousands of prank callers all phoning your business at "
            "the same time so real customers cannot get through. The attackers send so much "
            "fake internet traffic that the real traffic cannot reach our servers, making "
            "our website or services go down for everyone."
        ),
        "story_phase": "Impact",
        "risk": "High — Service availability impacted. Upstream DDoS mitigation required.",
    },
    "lateral_movement": {
        "technical": (
            "Lateral movement activity detected. An attacker with initial access to one system "
            "is attempting to access additional systems within the network (MITRE T1021). "
            "This phase indicates the attack has progressed beyond initial compromise. "
            "Network segmentation enforcement, privileged account audit, and endpoint "
            "isolation of affected systems are immediately required."
        ),
        "executive": (
            "An attacker who already has access to one of our systems is now trying to "
            "access other systems on our network. This means the situation is escalating — "
            "the attacker is trying to gain control of more systems. All affected systems "
            "need to be identified and isolated immediately."
        ),
        "beginner": (
            "After breaking into one room of a building, a burglar looks for ways to get "
            "into other rooms. That is what lateral movement means — the attacker already "
            "got into one computer and is now trying to reach other computers on the same "
            "network. We need to lock the doors between systems to stop them spreading further."
        ),
        "story_phase": "Lateral Movement",
        "risk": "Critical — Active internal spread. Immediate network segmentation and containment required.",
    },
    "c2": {
        "technical": (
            "Command and Control (C2) communication detected. A compromised internal host "
            "is communicating with an external attacker-controlled server (MITRE T1071). "
            "C2 channels enable remote code execution, data exfiltration coordination, and "
            "malware updates. The identified C2 IP/domain should be blocked immediately at "
            "the perimeter firewall and the communicating host isolated for forensic analysis."
        ),
        "executive": (
            "One of our computers has been compromised and is receiving instructions from "
            "an attacker's server outside our network. The attacker has remote control and "
            "can issue commands, steal data, or deploy additional malware. The affected "
            "system must be disconnected immediately."
        ),
        "beginner": (
            "Imagine a spy inside your building who has a secret radio transmitter and is "
            "receiving instructions from their handler outside. That is what C2 means — "
            "a hacker has installed software on one of our computers that secretly talks "
            "to the hacker's server and does whatever it is told."
        ),
        "story_phase": "Command and Control",
        "risk": "Critical — Active attacker control of internal host. Immediate isolation required.",
    },
    "network_anomaly": {
        "technical": (
            "Anomalous network traffic pattern detected that deviates from established baselines. "
            "The traffic characteristics — unusual volume, timing, protocol usage, or destination — "
            "indicate potential malicious activity or misconfiguration (MITRE T1046). "
            "Deep packet inspection and traffic analysis are recommended to classify the anomaly "
            "as benign, suspicious, or confirmed malicious."
        ),
        "executive": (
            "Our network monitoring systems detected unusual traffic that does not match "
            "normal patterns. This could indicate an attack in progress, a misconfigured "
            "device, or early-stage reconnaissance. Further investigation is needed to "
            "determine the cause and whether action is required."
        ),
        "beginner": (
            "Our network security system noticed traffic that looks different from the "
            "normal patterns — like noticing a stranger walking around your neighbourhood "
            "at 3 AM. It might be nothing, or it might be someone up to no good. "
            "A security analyst needs to look at it more carefully to find out."
        ),
        "story_phase": "Discovery",
        "risk": "Medium — Anomalous pattern requires further analysis to confirm or dismiss threat.",
    },
    "auth_failure": {
        "technical": (
            "Authentication failure events detected. Repeated failed login attempts against "
            "user accounts indicate potential credential guessing, account enumeration, or "
            "use of compromised credentials (MITRE T1110.001). Account lockout policies "
            "and failed login alerting thresholds should be reviewed."
        ),
        "executive": (
            "Multiple failed login attempts were recorded against user accounts. This could "
            "indicate an attacker trying to guess passwords, or a legitimate user who forgot "
            "their credentials. If from an external IP, this warrants immediate investigation."
        ),
        "beginner": (
            "Someone kept trying to log in to an account but kept getting the password wrong. "
            "This is like trying multiple PIN codes on a phone — it could be the real owner "
            "who forgot their password, or it could be someone trying to break in. "
            "We need to check who was trying and from where."
        ),
        "story_phase": "Credential Access",
        "risk": "Medium — Authentication failures require source analysis to determine intent.",
    },
}

_SEV_LABELS = {
    "critical": "🔴 CRITICAL",
    "high":     "🟠 HIGH",
    "medium":   "🟡 MEDIUM",
    "low":      "🟢 LOW",
}

_RECOMMENDATIONS = {
    "port_scan":       ["Block the scanning IP at the perimeter firewall.", "Enable IDS/IPS alerts for repeated connection attempts.", "Review and minimise externally exposed services.", "Increase monitoring frequency on targeted systems."],
    "brute_force":     ["Enable Multi-Factor Authentication (MFA) immediately.", "Implement account lockout after 5 failed attempts.", "Block the source IP at the firewall.", "Review all accounts for unauthorised access since the attack."],
    "ssh_brute":       ["Disable password-based SSH login — use key pairs only.", "Move SSH to a non-standard port.", "Install fail2ban to auto-block repeated failures.", "Restrict SSH access to known IP ranges via firewall rules."],
    "malware":         ["Isolate the affected host from the network immediately.", "Run a full EDR/antivirus scan.", "Check for persistence mechanisms (startup items, cron jobs, registry keys).", "Restore from a clean backup after full forensic investigation."],
    "data_exfil":      ["Block outbound connections to the identified destination IP.", "Enable Data Loss Prevention (DLP) policies.", "Audit what data was accessible on the compromised host.", "Assess regulatory notification requirements (GDPR, HIPAA, etc.)."],
    "ddos":            ["Contact your ISP to activate upstream traffic scrubbing.", "Enable rate limiting and connection throttling at the perimeter.", "Block identified source IP ranges.", "Activate DDoS mitigation service (Cloudflare, Akamai, AWS Shield)."],
    "lateral_movement":["Isolate all affected hosts from the network.", "Enforce network segmentation — VLANs and firewall rules between segments.", "Audit all service accounts and privileged credentials.", "Review Remote Desktop (RDP) and SMB access logs."],
    "c2":              ["Block the C2 IP/domain at the firewall immediately.", "Isolate the communicating host.", "Analyse all commands executed via the C2 channel.", "Check for additional implants on other hosts."],
    "network_anomaly": ["Capture and analyse the full packet stream for the affected period.", "Identify all systems involved in the anomalous traffic.", "Block if confirmed malicious; monitor closely if uncertain."],
    "auth_failure":    ["Review the source IP of failed attempts.", "Enable account lockout policies.", "Check if any attempt succeeded by reviewing successful login logs.", "Enable MFA on all affected accounts."],
}


def _extract_context(prompt: str) -> dict:
    """Pull key facts out of the prompt text for use in the analysis."""
    p = prompt.lower()

    # Attack types present
    types_found = [t for t in _ATTACK_KB if t.replace("_", " ") in p or t in p]
    if not types_found:
        # Generic fallback
        types_found = ["network_anomaly"]

    # IPs
    import re
    ips = re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', prompt)
    source_ips = list(dict.fromkeys(ips[:3]))

    # Severity
    sev = "medium"
    for s in ["critical", "high", "medium", "low"]:
        if s in p:
            sev = s
            break

    # Event count
    count_match = re.search(r'(\d+)\s+events?\s+analys', p)
    event_count = count_match.group(1) if count_match else "multiple"

    # Timeline
    ts_match = re.search(r'timeline[:\s]+([^\n]{5,60})', p, re.IGNORECASE)
    timeline = ts_match.group(1).strip() if ts_match else None

    return {
        "types":      types_found,
        "source_ips": source_ips,
        "severity":   sev,
        "count":      event_count,
        "timeline":   timeline,
    }


def _smart_fallback(prompt: str) -> str:
    """
    Full-featured rule-based analysis.
    Detects what is in the prompt and produces a complete structured response.
    """
    p = prompt.lower()
    ctx = _extract_context(prompt)

    # Determine which type of prompt this is
    is_story   = "chronological" in p or "reconstruct" in p or "narrative" in p
    is_chat    = "analyst question" in p or "question:" in p
    is_report_tech = "technical incident report" in p
    is_report_mgmt = "executive incident report" in p
    is_report_edu  = "educational incident report" in p
    is_beginner    = "beginner" in p and "explain" in p and "technical_event" in p

    types = ctx["types"]
    primary = types[0] if types else "network_anomaly"
    kb = _ATTACK_KB.get(primary, _ATTACK_KB["network_anomaly"])

    # ── Chat mode ──────────────────────────────────────────────────────────────
    if is_chat:
        return _chat_response(p, ctx, kb)

    # ── Attack story mode ──────────────────────────────────────────────────────
    if is_story:
        return _story_response(types, ctx)

    # ── Beginner explain mode ──────────────────────────────────────────────────
    if is_beginner:
        return kb["beginner"]

    # ── Report modes ───────────────────────────────────────────────────────────
    if is_report_tech:
        return _technical_report(types, ctx)
    if is_report_mgmt:
        return _management_report(types, ctx)
    if is_report_edu:
        return _educational_report(types, ctx)

    # ── Default: Full analysis (Technical + Executive + Beginner) ──────────────
    return _full_analysis(types, ctx)


def _full_analysis(types: list, ctx: dict) -> str:
    primary = types[0] if types else "network_anomaly"
    kb      = _ATTACK_KB.get(primary, _ATTACK_KB["network_anomaly"])
    sev_lbl = _SEV_LABELS.get(ctx["severity"], "🟡 MEDIUM")
    ips_str = ", ".join(ctx["source_ips"]) if ctx["source_ips"] else "Not identified"

    # Build multi-type technical note if more than one type found
    multi_note = ""
    if len(types) > 1:
        multi_note = (
            f"\n\nAdditional attack patterns also detected in this evidence: "
            f"{', '.join(t.replace('_', ' ').title() for t in types[1:])}. "
            f"This multi-vector activity increases the likelihood of a coordinated attack campaign."
        )

    recs = _RECOMMENDATIONS.get(primary, [])
    recs_text = "\n".join(f"• {r}" for r in recs)

    return f"""## TECHNICAL ANALYSIS
Severity: {sev_lbl}
Events Analysed: {ctx['count']}
Source IP(s): {ips_str}
{'Timeline: ' + ctx['timeline'] if ctx['timeline'] else ''}

{kb['technical']}{multi_note}

Immediate Recommended Actions:
{recs_text}

## EXECUTIVE SUMMARY
{kb['executive']}

Severity Assessment: {sev_lbl}
Source of Attack: {ips_str}
{'Timeframe: ' + ctx['timeline'] if ctx['timeline'] else ''}

## BEGINNER EXPLANATION
{kb['beginner']}"""


def _story_response(types: list, ctx: dict) -> str:
    lines = []
    ips_str = ", ".join(ctx["source_ips"]) if ctx["source_ips"] else "an unknown source"

    for i, atype in enumerate(types[:5], 1):
        kb = _ATTACK_KB.get(atype, _ATTACK_KB["network_anomaly"])
        recs = _RECOMMENDATIONS.get(atype, [])
        lines.append(f"""## Phase {i}: {kb['story_phase']}

**What happened:** {kb['technical'][:200]}...

**Evidence:** {atype.replace('_', ' ').title()} events detected originating from {ips_str}.

**Impact:** {kb['risk']}
""")

    lines.append(f"""## Overall Risk Assessment
The evidence shows a {'multi-phase coordinated attack' if len(types) > 1 else 'targeted security incident'} originating from {ips_str}. {'Multiple attack techniques were used in sequence, indicating a skilled and persistent threat actor.' if len(types) > 1 else 'The attack followed a focused pattern targeting specific systems.'} Immediate containment and forensic investigation are required. All affected systems should be isolated and credentials reset before resuming normal operations.""")

    return "\n".join(lines)


def _chat_response(prompt: str, ctx: dict, kb: dict) -> str:
    p = prompt.lower()
    types   = ctx["types"]
    primary = types[0] if types else "network_anomaly"
    ips_str = ", ".join(ctx["source_ips"]) if ctx["source_ips"] else "an unidentified source"
    recs    = _RECOMMENDATIONS.get(primary, [])

    if any(w in p for w in ["successful", "succeed", "did it work", "breach"]):
        return f"Based on the evidence, a definitive conclusion on whether the attack fully succeeded cannot be determined from alerts alone. However, the presence of {primary.replace('_', ' ')} activity from {ips_str} indicates active attack attempts. A successful login or data transfer event in the timeline would confirm compromise. Review authentication logs for successful sessions from the attacker IP."

    if any(w in p for w in ["first", "happened first", "start", "begin"]):
        first = types[0].replace("_", " ") if types else "anomalous activity"
        return f"The first detected event was {first} originating from {ips_str}. This is consistent with the initial phase ({kb['story_phase']}) of the attack. Review the Timeline tab for the full chronological sequence of events."

    if any(w in p for w in ["dangerous", "serious", "risk", "severity", "bad"]):
        return f"This incident is rated {_SEV_LABELS.get(ctx['severity'], 'MEDIUM')} severity. {kb['risk']} {'Multiple attack types were detected, increasing overall risk.' if len(types) > 1 else ''}"

    if any(w in p for w in ["host", "target", "which system", "affected"]):
        return f"The targeted system(s) identified in the evidence: {ips_str}. Check the Timeline tab for the full list of source and destination IPs involved in the incident."

    if any(w in p for w in ["do next", "recommend", "action", "fix", "prevent", "mitigate"]):
        steps = "\n".join(f"{i+1}. {r}" for i, r in enumerate(recs[:4]))
        return f"Based on the detected {primary.replace('_', ' ')} activity, here are the recommended immediate actions:\n\n{steps}\n\nReview the Remediation tab for the complete checklist with interactive progress tracking."

    if any(w in p for w in ["explain", "what is", "what does", "mean"]):
        return kb["beginner"]

    if any(w in p for w in ["credential", "password", "login", "account"]):
        if "brute" in str(types) or "auth" in str(types) or "ssh" in str(types):
            return "Yes — credential-based attacks were detected in this evidence. Authentication failure events indicate password guessing attempts. Review all accounts that share the targeted IP for unauthorised access. Enable MFA immediately on all affected accounts."
        return "No direct credential compromise was detected in this evidence. However, ensure all accounts on targeted systems have MFA enabled as a precaution."

    if any(w in p for w in ["data", "exfil", "stolen", "leak"]):
        if "data_exfil" in types or "dns_exfil" in types:
            return "Yes — data exfiltration activity was detected. Outbound data transfer to an external destination was identified. Immediate action: block the destination IP, audit what data was accessible on the affected system, and assess breach notification requirements."
        return "No confirmed data exfiltration was detected in this specific evidence. However, if the detected attack was successful, sensitive data on the targeted systems should be treated as potentially compromised."

    # Generic fallback for unknown questions
    return f"Based on the uploaded evidence: {len(types)} attack type(s) detected ({', '.join(t.replace('_',' ') for t in types)}), originating from {ips_str}, with severity rated {ctx['severity'].upper()}. {kb['executive']} For specific details, check the Analysis, Timeline, and MITRE tabs."


def _technical_report(types: list, ctx: dict) -> str:
    mitre_lines = []
    from app.ai.mitre_mapping import get_mitre
    for t in types:
        m = get_mitre(t)
        if m:
            mitre_lines.append(f"  • {m['technique_id']} — {m['technique_name']} ({m['tactic']})")

    iocs = []
    for ip in ctx["source_ips"]:
        iocs.append(f"  • Source IP: {ip}")

    recs = []
    for t in types[:2]:
        for r in _RECOMMENDATIONS.get(t, [])[:2]:
            recs.append(f"  • {r}")

    return f"""## Incident Summary
Severity: {_SEV_LABELS.get(ctx['severity'], 'MEDIUM')}
Events: {ctx['count']} security events analysed
Attack Vectors: {', '.join(t.replace('_',' ').title() for t in types)}
{'Timeline: ' + ctx['timeline'] if ctx['timeline'] else ''}

## Timeline of Events
{'  • Timeline data available in the uploaded evidence. Review the Timeline tab for full chronological reconstruction.' if not ctx['timeline'] else '  • ' + ctx['timeline']}

## Attack Vector Analysis
{chr(10).join(_ATTACK_KB.get(t, _ATTACK_KB['network_anomaly'])['technical'][:150] + '...' for t in types[:2])}

## Indicators of Compromise (IOCs)
{chr(10).join(iocs) if iocs else '  • No specific IOCs extracted — review raw event data.'}

## Affected Assets
  • Systems targeted by attack traffic from identified source IPs
  • Full asset list requires correlation with CMDB

## MITRE ATT&CK Techniques
{chr(10).join(mitre_lines) if mitre_lines else '  • See MITRE tab for technique mapping'}

## Recommended Immediate Actions
{chr(10).join(recs) if recs else '  • Review Remediation tab for full action list'}"""


def _management_report(types: list, ctx: dict) -> str:
    primary = types[0] if types else "network_anomaly"
    kb      = _ATTACK_KB.get(primary, _ATTACK_KB["network_anomaly"])
    return f"""## Incident Overview
A {ctx['severity'].upper()} severity security incident was detected involving {', '.join(t.replace('_',' ') for t in types)}.
{kb['executive']}

## Business Impact
  • {_ATTACK_KB.get(types[0], _ATTACK_KB['network_anomaly'])['risk']}
  • {'Multiple attack types detected — indicates coordinated threat actor activity.' if len(types) > 1 else 'Single attack vector detected.'}
  • Affected systems require immediate security review.

## Current Status
  • Incident detected and logged in SOC dashboard
  • Evidence collected and analysed
  • Remediation actions pending analyst approval

## Recommended Actions
  • Immediate: {_RECOMMENDATIONS.get(primary, ['Review and respond to the incident'])[0]}
  • Short-term: Enable MFA across all user accounts
  • Long-term: Conduct a full security posture review

## Next Steps
  • SOC team to implement immediate containment measures
  • Management to approve emergency change requests if required
  • Legal/Compliance review if data exposure is confirmed"""


def _educational_report(types: list, ctx: dict) -> str:
    primary = types[0] if types else "network_anomaly"
    kb      = _ATTACK_KB.get(primary, _ATTACK_KB["network_anomaly"])
    recs    = _RECOMMENDATIONS.get(primary, [])

    return f"""## What Happened (Plain English)
{kb['beginner']}

## How This Attack Works
{kb['technical'][:300]}...

## Why Attackers Do This
Attackers use {primary.replace('_', ' ')} techniques because they are effective against unprotected systems. This attack is rated {ctx['severity'].upper()} severity and falls under the "{kb['story_phase']}" phase of a typical cyberattack.

## What Could Have Prevented It
{chr(10).join('  • ' + r for r in recs[:3])}

## Key Terms Explained
  • SOC: Security Operations Center — the team that monitors for cyber threats
  • MITRE ATT&CK: A publicly available database of attacker techniques used worldwide
  • Severity: How dangerous an event is, rated Low → Medium → High → Critical
  • IOC: Indicator of Compromise — evidence that a system has been attacked

## Learning Takeaways
  • {primary.replace('_', ' ').title()} is a real attack technique used by threat actors worldwide
  • Early detection (as happened here) is critical to limiting damage
  • Defence-in-depth — multiple layers of security — reduces the impact of any single attack
  • Regular security monitoring and incident response training are essential"""

"""
AI Prompt Templates
====================
All Ollama prompts for the AI Investigation Center.
Keeping prompts in one file makes them easy to tune independently of service logic.
"""

# ── System role shared by all prompts ─────────────────────────────────────────
SYSTEM_ROLE = """You are a senior cybersecurity analyst and incident responder.
You explain security events clearly for three audiences:
1. Technical SOC analysts who need precise details.
2. Managers who need impact and business risk.
3. Students and beginners who need plain English.
Always base your analysis ONLY on the evidence provided. Never invent facts."""


# ── Feature 1 — Report Analysis ───────────────────────────────────────────────
ANALYSIS_PROMPT = """You are analysing a cybersecurity incident report.

EVIDENCE:
{evidence}

DETECTED INDICATORS:
- Attack Types: {attack_types}
- Source IPs: {source_ips}
- Target IPs: {target_ips}
- Severity: {severity}
- Timeline: {timeline}

Provide a structured analysis with EXACTLY these three sections, using these headers:

## TECHNICAL ANALYSIS
(Precise technical details for SOC analysts. Include attack vectors, indicators of compromise, and affected systems.)

## EXECUTIVE SUMMARY
(2-3 sentences for management. Focus on business impact and risk level. No jargon.)

## BEGINNER EXPLANATION
(Plain English for non-technical readers. Use an everyday analogy. No acronyms without explanation.)

Keep each section focused and factual. Only use information from the evidence provided."""


# ── Feature 2 — Attack Story Generator ───────────────────────────────────────
STORY_PROMPT = """You are a cybersecurity storyteller reconstructing an attack.

CHRONOLOGICAL EVENTS:
{events}

Reconstruct this as an attack narrative with clear phases.
For each phase, use this format:

## Phase N: [PHASE NAME]
**What happened:** (1-2 sentences describing the activity)
**Evidence:** (which specific events support this)
**Impact:** (what this phase enabled the attacker to do next)

Common phases to consider: Reconnaissance, Initial Access, Execution, Persistence, Privilege Escalation, Lateral Movement, Collection, Exfiltration, Impact.

Only use phases that are actually supported by the evidence.
End with a ## Overall Risk Assessment section (3-4 sentences)."""


# ── Feature 3 — Beginner Mode ─────────────────────────────────────────────────
BEGINNER_PROMPT = """You are explaining a cybersecurity event to someone with no technical background.

TECHNICAL EVENT:
{technical_event}

Write a short explanation (3-4 sentences maximum) using:
- Everyday analogies (house, bank, phone, etc.)
- Zero technical jargon (if you must use a term, immediately explain it in brackets)
- Active voice
- A final sentence stating what should be done next

Do NOT use: acronyms, IP addresses as raw numbers, port numbers without context."""


# ── Feature 4 — Incident Chat ─────────────────────────────────────────────────
CHAT_PROMPT = """You are an AI cybersecurity assistant. Answer the analyst's question using ONLY the incident data below.
If the answer is not in the data, say "I cannot determine that from the available evidence."

INCIDENT DATA:
{incident_context}

ANALYST QUESTION:
{question}

Rules:
- Be concise (under 150 words unless detail is essential)
- Cite specific evidence when making claims
- If asked for recommendations, give 2-3 actionable steps
- Never speculate beyond what the evidence shows"""


# ── Feature 7 — Multi-View Report ────────────────────────────────────────────
TECHNICAL_REPORT_PROMPT = """Generate a technical incident report for SOC analysts.

EVIDENCE:
{evidence}

MITRE MAPPING:
{mitre_mapping}

Structure:
## Incident Summary
## Timeline of Events
## Attack Vector Analysis
## Indicators of Compromise (IOCs)
## Affected Assets
## MITRE ATT&CK Techniques
## Recommended Immediate Actions

Be precise. Include all technical details. Use security terminology correctly."""

MANAGEMENT_REPORT_PROMPT = """Generate an executive incident report for senior management.

INCIDENT SUMMARY:
{summary}

Rules:
- No technical jargon
- Focus on: What happened, business impact, what is being done, what is needed
- Maximum 400 words
- Use bullet points for action items

Structure:
## Incident Overview
## Business Impact
## Current Status
## Recommended Actions
## Next Steps"""

EDUCATIONAL_REPORT_PROMPT = """Generate an educational incident report for cybersecurity students.

INCIDENT DATA:
{evidence}

ATTACK TYPES DETECTED:
{attack_types}

Structure:
## What Happened (Plain English)
## How This Attack Works
## Why Attackers Do This
## What Could Have Prevented It
## Key Terms Explained
## Learning Takeaways

Use simple language. Include real-world analogies. Make it educational, not alarming."""

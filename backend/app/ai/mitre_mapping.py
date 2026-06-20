"""
MITRE ATT&CK Mapping
=====================
Maps internal alert/threat types to official ATT&CK technique IDs,
technique names, tactics, and remediation guidance.
"""

from typing import Optional

MITRE_DB = {
    # ── Reconnaissance ────────────────────────────────────────────────────────
    "port_scan": {
        "technique_id":   "T1046",
        "technique_name": "Network Service Discovery",
        "tactic":         "Reconnaissance",
        "tactic_id":      "TA0043",
        "description":    "Adversary attempts to discover which network services are running.",
        "severity_bump":  0,
        "remediation": [
            "Enable firewall rules to block unsolicited inbound scans.",
            "Deploy an IDS/IPS to detect and alert on scan patterns.",
            "Restrict externally exposed services to the minimum required set.",
            "Monitor for repeated connection attempts from single sources.",
        ],
    },
    "network_scan": {
        "technique_id":   "T1595",
        "technique_name": "Active Scanning",
        "tactic":         "Reconnaissance",
        "tactic_id":      "TA0043",
        "description":    "Mass scanning of IP ranges to enumerate live hosts.",
        "severity_bump":  0,
        "remediation": [
            "Implement rate-limiting at the network perimeter.",
            "Block source IPs with repeated scan behaviour.",
            "Deploy honeypots to detect scanning activity early.",
        ],
    },

    # ── Credential Access ─────────────────────────────────────────────────────
    "brute_force":  {
        "technique_id":   "T1110",
        "technique_name": "Brute Force",
        "tactic":         "Credential Access",
        "tactic_id":      "TA0006",
        "description":    "Repeated attempts to guess credentials by trying many passwords.",
        "severity_bump":  1,
        "remediation": [
            "Enable Multi-Factor Authentication (MFA) on all accounts.",
            "Implement account lockout after 5–10 failed attempts.",
            "Enforce a strong password policy (12+ chars, mixed types).",
            "Block or throttle IPs with excessive failed login attempts.",
            "Alert on repeated authentication failures from one source.",
        ],
    },
    "auth_failure": {
        "technique_id":   "T1110.001",
        "technique_name": "Password Guessing",
        "tactic":         "Credential Access",
        "tactic_id":      "TA0006",
        "description":    "Attacker guessing passwords for known accounts.",
        "severity_bump":  0,
        "remediation": [
            "Enable MFA immediately.",
            "Review accounts with repeated failures for compromise.",
            "Implement IP-based rate limiting on authentication endpoints.",
        ],
    },
    "ssh_brute":    {
        "technique_id":   "T1110.004",
        "technique_name": "Credential Stuffing via SSH",
        "tactic":         "Credential Access",
        "tactic_id":      "TA0006",
        "description":    "Automated SSH login attempts using credential lists.",
        "severity_bump":  1,
        "remediation": [
            "Disable password-based SSH; use key-based authentication only.",
            "Move SSH to a non-standard port.",
            "Install fail2ban or equivalent to auto-block repeated failures.",
            "Restrict SSH access to known IP ranges via firewall.",
        ],
    },

    # ── Initial Access ────────────────────────────────────────────────────────
    "malware": {
        "technique_id":   "T1059",
        "technique_name": "Command and Scripting Interpreter",
        "tactic":         "Execution",
        "tactic_id":      "TA0002",
        "description":    "Malicious code executed via scripting or command interpreter.",
        "severity_bump":  2,
        "remediation": [
            "Isolate the affected host immediately.",
            "Run a full antivirus/EDR scan on the system.",
            "Check for persistence mechanisms (startup items, scheduled tasks).",
            "Review recently installed software and scripts.",
            "Restore from a known-clean backup after full investigation.",
        ],
    },

    # ── Exfiltration ──────────────────────────────────────────────────────────
    "data_exfil": {
        "technique_id":   "T1041",
        "technique_name": "Exfiltration Over C2 Channel",
        "tactic":         "Exfiltration",
        "tactic_id":      "TA0010",
        "description":    "Data transferred out of the network through a command-and-control channel.",
        "severity_bump":  2,
        "remediation": [
            "Block outbound connections to the identified C2 IP/domain.",
            "Inspect outbound traffic for anomalous data volumes.",
            "Enable Data Loss Prevention (DLP) policies.",
            "Audit which data was accessible on the compromised host.",
        ],
    },
    "dns_exfil": {
        "technique_id":   "T1048.003",
        "technique_name": "Exfiltration Over Unencrypted Non-C2 Protocol (DNS)",
        "tactic":         "Exfiltration",
        "tactic_id":      "TA0010",
        "description":    "Data encoded and tunnelled inside DNS query traffic.",
        "severity_bump":  2,
        "remediation": [
            "Monitor for unusually long or high-frequency DNS queries.",
            "Deploy DNS filtering to block known-malicious resolvers.",
            "Restrict DNS to internal resolvers only.",
            "Investigate the specific DNS queries captured.",
        ],
    },

    # ── Impact ────────────────────────────────────────────────────────────────
    "ddos": {
        "technique_id":   "T1498",
        "technique_name": "Network Denial of Service",
        "tactic":         "Impact",
        "tactic_id":      "TA0040",
        "description":    "Flood of traffic rendering a service unavailable.",
        "severity_bump":  1,
        "remediation": [
            "Activate upstream DDoS mitigation (ISP scrubbing or CDN protection).",
            "Implement rate limiting and connection throttling.",
            "Block identified source IPs at the network perimeter.",
            "Engage incident response if service disruption is sustained.",
        ],
    },

    # ── Lateral Movement ─────────────────────────────────────────────────────
    "lateral_movement": {
        "technique_id":   "T1021",
        "technique_name": "Remote Services",
        "tactic":         "Lateral Movement",
        "tactic_id":      "TA0008",
        "description":    "Attacker using remote access services to move between hosts.",
        "severity_bump":  2,
        "remediation": [
            "Segment the network to prevent east-west movement.",
            "Audit all accounts used for remote access.",
            "Review and restrict RDP/SSH permissions.",
            "Investigate all hosts the attacker may have reached.",
        ],
    },

    # ── Command & Control ─────────────────────────────────────────────────────
    "c2": {
        "technique_id":   "T1071",
        "technique_name": "Application Layer Protocol",
        "tactic":         "Command and Control",
        "tactic_id":      "TA0011",
        "description":    "Attacker communicating with a compromised host over a standard protocol.",
        "severity_bump":  2,
        "remediation": [
            "Block the C2 IP/domain at the firewall immediately.",
            "Investigate all commands that may have been executed.",
            "Review proxy logs for the full communication history.",
            "Check for persistence mechanisms installed by the C2 implant.",
        ],
    },

    # ── Persistence ───────────────────────────────────────────────────────────
    "persistence": {
        "technique_id":   "T1136",
        "technique_name": "Create Account",
        "tactic":         "Persistence",
        "tactic_id":      "TA0003",
        "description":    "Attacker created a new account to maintain access.",
        "severity_bump":  2,
        "remediation": [
            "Audit all user accounts created in the last 24–48 hours.",
            "Disable and investigate any unauthorised accounts.",
            "Review sudo/admin group membership.",
            "Enable alerting on new account creation.",
        ],
    },

    # ── Discovery ─────────────────────────────────────────────────────────────
    "network_anomaly": {
        "technique_id":   "T1046",
        "technique_name": "Network Service Discovery",
        "tactic":         "Discovery",
        "tactic_id":      "TA0007",
        "description":    "Abnormal network traffic pattern indicating reconnaissance or exfiltration.",
        "severity_bump":  0,
        "remediation": [
            "Capture and analyse the full packet stream for that time window.",
            "Identify the source and destination of anomalous traffic.",
            "Block if confirmed malicious; monitor if uncertain.",
        ],
    },
}

# Beginner-friendly plain-language explanations
PLAIN_ENGLISH = {
    "port_scan":        "An attacker checked which doors and windows of the system were open before attempting to break in.",
    "network_scan":     "An attacker mapped the entire neighbourhood of systems to find potential targets.",
    "brute_force":      "Imagine someone trying hundreds of keys on your house door until one works. The attacker repeatedly tried passwords hoping one would be correct.",
    "auth_failure":     "Someone tried to log in but got the password wrong, possibly by guessing.",
    "ssh_brute":        "An automated program repeatedly tried to log in over SSH — the remote management system — using thousands of different passwords.",
    "malware":          "Malicious software was detected running on the system. Think of it like a virus on a phone, but for a computer.",
    "data_exfil":       "The attacker was trying to copy and send your private data to their own server, like a burglar walking out with your files.",
    "dns_exfil":        "The attacker hid stolen data inside normal-looking website lookup requests to sneak it out of the network.",
    "ddos":             "The attacker flooded the system with so many fake requests that it became too busy to serve real users — like jamming a phone line.",
    "lateral_movement": "After gaining access to one computer, the attacker tried to move across the network to reach other machines.",
    "c2":               "A compromised machine was receiving instructions from the attacker's remote server — like a hacker controlling a puppet.",
    "persistence":      "The attacker created a backdoor to ensure they could return even after being discovered and removed.",
    "network_anomaly":  "The system noticed unusual traffic that does not match normal patterns — something out of the ordinary was happening on the network.",
}


def get_mitre(alert_type: str) -> Optional[dict]:
    """Return full MITRE entry for an alert type, or None."""
    return MITRE_DB.get(str(alert_type).lower().replace(" ", "_"))


def get_plain_english(alert_type: str) -> str:
    """Return beginner-friendly explanation, or a generic fallback."""
    key = str(alert_type).lower().replace(" ", "_")
    return PLAIN_ENGLISH.get(
        key,
        "An unusual security event was detected. Further analysis is needed to determine its impact."
    )


def get_all_techniques_for_events(events: list) -> list:
    """
    Given a list of event dicts (each having an 'alert_type' or 'event_type'),
    return a deduplicated list of MITRE entries.
    """
    seen = set()
    results = []
    for ev in events:
        atype = ev.get("alert_type") or ev.get("event_type") or ev.get("type", "")
        entry = get_mitre(atype)
        if entry and entry["technique_id"] not in seen:
            seen.add(entry["technique_id"])
            results.append({**entry, "alert_type": atype})
    return results

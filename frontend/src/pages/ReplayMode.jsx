/**
 * Attack Scenario Replay Mode
 * ============================
 * A fully interactive SOC training simulator that replays real attack
 * scenarios step-by-step with:
 *  - Animated timeline showing each attack phase
 *  - Live event log feed per step
 *  - MITRE ATT&CK tactic tagging
 *  - Analyst action prompts at each step
 *  - Severity scoring progression
 *  - Replay speed control
 *  - Scenario completion report
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Scenario Data ─────────────────────────────────────────────────────────────
const SCENARIOS = {
  brute_force: {
    name: "SSH Brute Force → Privilege Escalation",
    description: "Attacker from external IP performs credential stuffing on SSH, gains foothold, then escalates privileges.",
    threat_actor: "APT-28 (Fancy Bear)",
    severity: "critical",
    mitre_tactics: ["Reconnaissance","Initial Access","Privilege Escalation","Lateral Movement"],
    steps: [
      { id:1, phase:"Reconnaissance",       tactic:"T1595",  time:"00:00", severity:"info",
        title:"External Port Scan Detected",
        description:"Source IP 45.22.11.9 scanned 1,024 ports on the target host in 4.2 seconds. nmap fingerprint pattern detected.",
        logs:["May 27 00:00:01 firewall kernel: [DROP] IN=eth0 SRC=45.22.11.9 DST=10.0.0.5 DPT=22","May 27 00:00:02 firewall kernel: [DROP] IN=eth0 SRC=45.22.11.9 DST=10.0.0.5 DPT=80","May 27 00:00:03 firewall kernel: [DROP] IN=eth0 SRC=45.22.11.9 DST=10.0.0.5 DPT=443","May 27 00:00:04 firewall kernel: [DROP] IN=eth0 SRC=45.22.11.9 DST=10.0.0.5 DPT=3306"],
        analyst_action:"Check firewall logs. Block source IP if scan confirmed.",
        ioc:"45.22.11.9 — Threat Intel: Listed on 3 blocklists" },

      { id:2, phase:"Initial Access",        tactic:"T1110",  time:"00:03", severity:"warning",
        title:"SSH Brute Force Begins",
        description:"45+ failed SSH login attempts from 45.22.11.9 targeting user 'root', 'admin', 'ubuntu'. Rate: 12 attempts/second.",
        logs:["May 27 00:03:11 auth.log sshd[4821]: Failed password for root from 45.22.11.9 port 51234 ssh2","May 27 00:03:11 auth.log sshd[4822]: Failed password for admin from 45.22.11.9 port 51235 ssh2","May 27 00:03:12 auth.log sshd[4823]: Failed password for ubuntu from 45.22.11.9 port 51236 ssh2","May 27 00:03:14 auth.log sshd[4824]: Failed password for root from 45.22.11.9 port 51240 ssh2"],
        analyst_action:"Rate-limit SSH connections. Consider fail2ban rule. Alert SOC team.",
        ioc:"45 failed attempts in 4 seconds — automated tool signature" },

      { id:3, phase:"Initial Access",        tactic:"T1078",  time:"00:05", severity:"error",
        title:"SSH Login Succeeded — Weak Credential",
        description:"Attacker successfully authenticated as user 'deploy' using password 'deploy123'. Session established from 45.22.11.9.",
        logs:["May 27 00:05:33 auth.log sshd[4901]: Accepted password for deploy from 45.22.11.9 port 51290 ssh2","May 27 00:05:33 auth.log sshd[4901]: pam_unix(sshd:session): session opened for user deploy","May 27 00:05:34 syslog systemd-logind[423]: New session 88 of user deploy."],
        analyst_action:"IMMEDIATELY: Disable 'deploy' account. Revoke session. Rotate credentials.",
        ioc:"Credential 'deploy:deploy123' — default/weak password" },

      { id:4, phase:"Privilege Escalation",  tactic:"T1548",  time:"00:07", severity:"error",
        title:"Sudo Escalation Attempt",
        description:"Attacker ran 'sudo su -' and 'sudo bash' from the deploy session. Third attempt succeeded using misconfigured sudoers entry.",
        logs:["May 27 00:07:01 auth.log sudo: deploy : command not allowed ; TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/bin/bash","May 27 00:07:03 auth.log sudo: deploy : TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/bin/bash","May 27 00:07:05 auth.log sudo: deploy : TTY=pts/0 ; PWD=/ ; USER=root ; COMMAND=ALL","May 27 00:07:05 auth.log sudo: pam_unix(sudo:session): session opened for user root"],
        analyst_action:"Audit sudoers file. Remove wildcard entries. Kill root session.",
        ioc:"Misconfigured NOPASSWD sudo entry for user 'deploy'" },

      { id:5, phase:"Persistence",           tactic:"T1136",  time:"00:09", severity:"critical",
        title:"Backdoor Account Created",
        description:"Attacker created new user 'svcback' with UID 0 (root-level). Added SSH public key to /root/.ssh/authorized_keys.",
        logs:["May 27 00:09:12 syslog useradd[5012]: new user: name=svcback, UID=0, GID=0, home=/root, shell=/bin/bash","May 27 00:09:13 auth.log sshd[5020]: Accepted publickey for svcback from 45.22.11.9","May 27 00:09:14 syslog: echo 'ssh-rsa AAAA...attacker_key' >> /root/.ssh/authorized_keys"],
        analyst_action:"CRITICAL: Delete 'svcback'. Remove attacker SSH key. Isolate host immediately.",
        ioc:"UID=0 user created outside provisioning system — clear backdoor" },

      { id:6, phase:"Lateral Movement",      tactic:"T1021",  time:"00:12", severity:"critical",
        title:"Internal Network Scanning",
        description:"Compromised host now scanning internal /24 subnet on ports 22, 3389, 445. Classic lateral movement pattern.",
        logs:["May 27 00:12:01 firewall: [ALERT] Internal scan from 10.0.0.5 → 10.0.0.1:22","May 27 00:12:02 firewall: [ALERT] Internal scan from 10.0.0.5 → 10.0.0.2:3389","May 27 00:12:03 firewall: [ALERT] Internal scan from 10.0.0.5 → 10.0.0.3:445","May 27 00:12:05 firewall: [ALERT] Internal scan from 10.0.0.5 → 10.0.0.4:22"],
        analyst_action:"CONTAIN: Block 10.0.0.5 at switch level. Initiate IR playbook. Preserve memory.",
        ioc:"Compromised internal host scanning peers — lateral movement confirmed" },
    ]
  },

  data_exfiltration: {
    name: "Insider Threat: Data Exfiltration",
    description: "Trusted employee exfiltrates sensitive data over DNS tunneling, then via encrypted HTTPS upload to personal cloud storage.",
    threat_actor: "Insider Threat — Disgruntled Employee",
    severity: "high",
    mitre_tactics: ["Collection","Exfiltration","Defense Evasion"],
    steps: [
      { id:1, phase:"Collection",            tactic:"T1005",  time:"00:00", severity:"info",
        title:"Unusual File Access Pattern",
        description:"User 'jsmith' accessed 847 files in the /confidential/ directory in 12 minutes. Normal baseline: 10-15 files/day.",
        logs:["May 27 01:00:01 audit.log type=SYSCALL msg=audit: exe=/usr/bin/cp fname=/confidential/Q4_financials.xlsx uid=1042","May 27 01:00:03 audit.log type=SYSCALL msg=audit: exe=/usr/bin/cp fname=/confidential/customer_PII.csv uid=1042","May 27 01:00:07 audit.log type=SYSCALL msg=audit: exe=/usr/bin/tar fname=/confidential/ uid=1042"],
        analyst_action:"Alert HR and legal. Preserve audit logs. Do not tip off employee yet.",
        ioc:"847 file reads in 12 min — 56x above baseline for this user" },

      { id:2, phase:"Defense Evasion",       tactic:"T1048",  time:"00:14", severity:"warning",
        title:"DNS Tunneling Detected",
        description:"Abnormally long DNS queries to exfil.tunnel.ru. Queries contain base64-encoded data — classic DNS exfiltration technique.",
        logs:["May 27 01:14:22 dns.log query: ZmlsZXMvY29uZmlkZW50aWFsL2N1c3RvbWVyX1BJSS5jc3Y=.exfil.tunnel.ru","May 27 01:14:23 dns.log query: cGFydDI=.exfil.tunnel.ru TXT","May 27 01:14:25 dns.log query: Q2xhc3NpZmllZC1GaW5hbmNpYWxzLnhsc3g=.exfil.tunnel.ru"],
        analyst_action:"Block exfil.tunnel.ru at DNS resolver. Capture pcap for forensics.",
        ioc:"Base64 data in DNS query labels — confirmed DNS tunneling" },

      { id:3, phase:"Exfiltration",          tactic:"T1567",  time:"00:22", severity:"error",
        title:"Large HTTPS Upload to Cloud Storage",
        description:"2.3GB upload to dropbox.com from host in 4 minutes. Outside business hours. Source is same host accessing /confidential/.",
        logs:["May 27 01:22:01 proxy.log CONNECT dropbox.com:443 200 2341829312 bytes jsmith 10.0.0.5","May 27 01:22:04 netflow: src=10.0.0.5 dst=162.125.1.1 bytes=2341829312 duration=240s"],
        analyst_action:"Block upload at DLP proxy. Legal hold on employee. Isolate workstation.",
        ioc:"2.3GB in 4 min to cloud storage — DLP policy violation" },

      { id:4, phase:"Exfiltration",          tactic:"T1020",  time:"00:28", severity:"critical",
        title:"USB Mass Storage Device Connected",
        description:"USB storage device connected to workstation WKSTN-07 (jsmith). 1.8GB written in 3 minutes while uploads were active.",
        logs:["May 27 01:28:11 kernel: usb 1-1: new high-speed USB device number 4 using xhci_hcd","May 27 01:28:11 kernel: usb-storage 1-1:1.0: USB Mass Storage device detected","May 27 01:28:12 audit.log type=SYSCALL exe=/usr/bin/cp fname=/media/USB_DRIVE uid=1042"],
        analyst_action:"PHYSICAL: Security team to workstation now. Confiscate USB device as evidence.",
        ioc:"Simultaneous cloud + USB exfil — dual-channel exfiltration attempt" },
    ]
  },

  malware_infection: {
    name: "Malware Infection → C2 Beacon → Ransomware",
    description: "Phishing email delivers malware dropper, establishes C2 channel, then deploys ransomware across network shares.",
    threat_actor: "LockBit 3.0 Affiliate",
    severity: "critical",
    mitre_tactics: ["Initial Access","Execution","Command & Control","Impact"],
    steps: [
      { id:1, phase:"Initial Access",        tactic:"T1566",  time:"00:00", severity:"warning",
        title:"Phishing Email with Malicious Macro",
        description:"User 'mwilson' opened Invoice_Q4.xlsm from external sender. Excel spawned cmd.exe — macro execution confirmed.",
        logs:["May 27 02:00:01 EDR: Process create: EXCEL.EXE → cmd.exe /c powershell -enc JABzAD0A... (encoded)","May 27 02:00:02 EDR: Suspicious child process: EXCEL.EXE PID=3821 → powershell.exe PID=3901","May 27 02:00:03 EDR: Network connect: powershell.exe → 91.195.240.44:443"],
        analyst_action:"Quarantine WKSTN-12 immediately. Pull email from all mailboxes. Block sender domain.",
        ioc:"EXCEL.EXE spawning PowerShell with encoded command — malware dropper" },

      { id:2, phase:"Execution",             tactic:"T1059",  time:"00:01", severity:"error",
        title:"Dropper Downloads Second Stage Payload",
        description:"PowerShell downloaded stage-2 payload from 91.195.240.44. Payload saved to %TEMP%\\svchost32.exe and executed.",
        logs:["May 27 02:01:44 EDR: File write: C:\\Users\\mwilson\\AppData\\Local\\Temp\\svchost32.exe (2.1MB)","May 27 02:01:45 EDR: Process create: svchost32.exe — NOT a Microsoft binary (unsigned)","May 27 02:01:46 EDR: Registry write: HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run → svchost32.exe"],
        analyst_action:"Hash svchost32.exe. Submit to VirusTotal. Block hash at AV. Kill process.",
        ioc:"SHA256: 4a8f2c1d... — 47/72 AV detections on VirusTotal" },

      { id:3, phase:"Command & Control",     tactic:"T1071",  time:"00:03", severity:"error",
        title:"C2 Beacon Established",
        description:"Malware beaconing to 91.195.240.44 every 60s via HTTPS. JA3 fingerprint matches known LockBit C2 infrastructure.",
        logs:["May 27 02:03:01 proxy.log CONNECT 91.195.240.44:443 200 beacon_interval=60s","May 27 02:04:01 proxy.log CONNECT 91.195.240.44:443 200 beacon_interval=60s","May 27 02:05:01 proxy.log CONNECT 91.195.240.44:443 200 beacon_interval=60s","May 27 02:05:01 firewall: JA3=a0e9f5d... matches LockBit C2 fingerprint DB"],
        analyst_action:"Block 91.195.240.44 at perimeter. Enable full SSL inspection. Check lateral spread.",
        ioc:"JA3: a0e9f5d... — LockBit 3.0 C2 fingerprint confirmed" },

      { id:4, phase:"Discovery",             tactic:"T1135",  time:"00:08", severity:"critical",
        title:"Network Share Enumeration",
        description:"Malware enumerated all network shares using net view and SMB scanning. 23 shares found including \\\\FILESERVER\\Finance.",
        logs:["May 27 02:08:12 syslog: SMB session from WKSTN-12 to FILESERVER — net view \\\\FILESERVER","May 27 02:08:13 syslog: SMB: WKSTN-12 accessed \\\\FILESERVER\\Finance (read)","May 27 02:08:14 syslog: SMB: WKSTN-12 accessed \\\\FILESERVER\\HR_Records (read)","May 27 02:08:15 syslog: 23 shares enumerated from WKSTN-12 in 3 seconds"],
        analyst_action:"Isolate WKSTN-12 from network immediately. Restrict SMB at switch. Alert CISO.",
        ioc:"23 shares enumerated in 3s — automated SMB discovery tool" },

      { id:5, phase:"Impact",                tactic:"T1486",  time:"00:15", severity:"critical",
        title:"🔴 RANSOMWARE ENCRYPTING FILES",
        description:"CRITICAL: Ransomware actively encrypting files on \\\\FILESERVER\\Finance. .lockbit extension being appended. Ransom note dropped: README_RESTORE.txt",
        logs:["May 27 02:15:01 EDR: Mass file rename: *.xlsx → *.lockbit (847 files in 30s)","May 27 02:15:02 EDR: Mass file rename: *.docx → *.lockbit (1,203 files in 30s)","May 27 02:15:03 EDR: File create: \\\\FILESERVER\\Finance\\README_RESTORE.txt","May 27 02:15:04 EDR: Mass file rename: *.pdf → *.lockbit (2,891 files in 30s)"],
        analyst_action:"EMERGENCY: Pull network cable on FILESERVER. Activate BCP. Contact IR retainer NOW.",
        ioc:"LockBit 3.0 — .lockbit extension — Ransom demand: $450,000 USD in BTC" },
    ]
  },
};

// ── Severity helpers ──────────────────────────────────────────────────────────
const SEV = {
  info:     { color:'#38bdf8', bg:'rgba(56,189,248,0.08)',   label:'INFO',  icon:'ℹ️' },
  warning:  { color:'#eab308', bg:'rgba(234,179,8,0.08)',    label:'WARN',  icon:'⚠️' },
  error:    { color:'#f97316', bg:'rgba(249,115,22,0.08)',   label:'ERROR', icon:'🔴' },
  critical: { color:'#ef4444', bg:'rgba(239,68,68,0.10)',    label:'CRIT',  icon:'🚨' },
};
const s = (sev) => SEV[sev] || SEV.info;

// ── Sub-components ────────────────────────────────────────────────────────────

function PhaseBar({ steps, currentStep, completedSteps }) {
  return (
    <div style={{ display:'flex', gap:0, marginBottom:'1.5rem', borderRadius:8, overflow:'hidden' }}>
      {steps.map((step, idx) => {
        const done    = completedSteps.includes(step.id);
        const active  = currentStep === step.id;
        const sv      = s(step.severity);
        return (
          <div key={step.id} style={{
            flex:1, padding:'8px 4px', textAlign:'center', fontSize:'0.68rem',
            backgroundColor: active ? sv.bg : done ? 'rgba(30,41,59,0.8)' : 'rgba(15,23,42,0.6)',
            borderTop: active ? `2px solid ${sv.color}` : done ? '2px solid #22c55e' : '2px solid #1e293b',
            transition:'all 0.3s', position:'relative',
          }}>
            <div style={{ color: active ? sv.color : done ? '#22c55e' : '#475569', fontWeight: active ? 700 : 400 }}>
              {done ? '✓' : active ? sv.icon : `${idx+1}`}
            </div>
            <div style={{ color: active ? '#f8fafc' : done ? '#94a3b8' : '#334155', marginTop:2, lineHeight:1.2 }}>
              {step.phase}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ step, isActive, isDone }) {
  const sv = s(step.severity);
  if (!isActive && !isDone) return null;
  return (
    <div style={{
      backgroundColor:'#0f172a', border:`1px solid ${isDone && !isActive ? '#1e293b' : sv.color}40`,
      borderLeft:`3px solid ${isDone && !isActive ? '#22c55e' : sv.color}`,
      borderRadius:8, padding:'1rem 1.2rem', marginBottom:'0.75rem',
      opacity: isDone && !isActive ? 0.65 : 1,
      transition:'all 0.4s',
      animation: isActive ? 'stepIn 0.4s ease-out' : 'none',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        <span style={{ fontSize:'1rem' }}>{isDone && !isActive ? '✅' : sv.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color: isDone && !isActive ? '#94a3b8' : sv.color, fontWeight:700, fontSize:'0.9rem' }}>
              {step.title}
            </span>
            <span style={{ fontSize:'0.65rem', padding:'1px 6px', borderRadius:4,
                           backgroundColor:`${sv.color}18`, color:sv.color, border:`1px solid ${sv.color}30` }}>
              {step.tactic}
            </span>
          </div>
          <div style={{ color:'#475569', fontSize:'0.72rem', marginTop:2 }}>
            T+{step.time} — {step.phase}
          </div>
        </div>
      </div>
      <p style={{ color:'#94a3b8', fontSize:'0.82rem', margin:'0 0 10px', lineHeight:1.5 }}>
        {step.description}
      </p>

      {/* Log lines */}
      <div style={{ backgroundColor:'#0a0e1a', borderRadius:6, padding:'8px 10px', marginBottom:10, fontFamily:'monospace', fontSize:'0.72rem' }}>
        {step.logs.map((log, i) => (
          <div key={i} style={{ color:'#64748b', padding:'1px 0',
                                animation: isActive ? `logLine 0.3s ${i*0.1}s ease-out both` : 'none' }}>
            <span style={{ color:sv.color }}>[{sv.label}]</span> {log}
          </div>
        ))}
      </div>

      {/* IOC */}
      <div style={{ backgroundColor:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)',
                    borderRadius:6, padding:'6px 10px', marginBottom:10, fontSize:'0.75rem' }}>
        <span style={{ color:'#ef4444', fontWeight:700 }}>⚑ IOC: </span>
        <span style={{ color:'#fca5a5' }}>{step.ioc}</span>
      </div>

      {/* Analyst action */}
      {isActive && (
        <div style={{ backgroundColor:'rgba(56,189,248,0.06)', border:'1px solid rgba(56,189,248,0.25)',
                      borderRadius:6, padding:'8px 12px', fontSize:'0.78rem' }}>
          <span style={{ color:'#38bdf8', fontWeight:700 }}>🎯 Analyst Action: </span>
          <span style={{ color:'#bae6fd' }}>{step.analyst_action}</span>
        </div>
      )}
    </div>
  );
}

function ScorePanel({ completedSteps, totalSteps, scenario }) {
  const pct = Math.round((completedSteps.length / totalSteps) * 100);
  const responseScore = Math.max(0, 100 - completedSteps.length * 8);
  return (
    <div style={{ backgroundColor:'#0f172a', border:'1px solid rgba(51,65,85,0.5)',
                  borderRadius:10, padding:'1rem' }}>
      <div style={{ color:'#94a3b8', fontSize:'0.75rem', textTransform:'uppercase',
                    letterSpacing:'0.06em', marginBottom:10 }}>Scenario Progress</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ color:'#38bdf8', fontSize:'1.6rem', fontWeight:700 }}>{pct}%</div>
          <div style={{ color:'#475569', fontSize:'0.7rem' }}>Scenario Complete</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ color: responseScore > 70 ? '#22c55e' : responseScore > 40 ? '#eab308' : '#ef4444',
                        fontSize:'1.6rem', fontWeight:700 }}>{responseScore}</div>
          <div style={{ color:'#475569', fontSize:'0.7rem' }}>Response Score</div>
        </div>
      </div>
      <div style={{ height:6, backgroundColor:'#1e293b', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, borderRadius:3,
                      backgroundColor: pct < 40 ? '#22c55e' : pct < 70 ? '#eab308' : '#ef4444',
                      transition:'width 0.5s ease' }} />
      </div>
      <div style={{ marginTop:10, fontSize:'0.72rem', color:'#64748b' }}>
        {completedSteps.length}/{totalSteps} attack phases observed
      </div>
    </div>
  );
}

function CompletionReport({ scenario, onReset }) {
  const sev = scenario.severity;
  const color = sev === 'critical' ? '#ef4444' : '#eab308';
  return (
    <div style={{ backgroundColor:'#0a0e1a', border:`1px solid ${color}40`,
                  borderRadius:12, padding:'2rem', textAlign:'center', animation:'fadeIn 0.6s ease-out' }}>
      <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>
        {sev === 'critical' ? '🚨' : '⚠️'}
      </div>
      <h2 style={{ color, margin:'0 0 0.5rem', fontSize:'1.4rem' }}>
        Scenario Complete: {scenario.name}
      </h2>
      <p style={{ color:'#94a3b8', margin:'0 0 1.5rem', fontSize:'0.9rem' }}>
        Threat Actor: <strong style={{ color:'#f8fafc' }}>{scenario.threat_actor}</strong>
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:'1.5rem' }}>
        {[
          { label:'Attack Phases', value: scenario.steps.length,          color:'#ef4444' },
          { label:'MITRE Tactics', value: scenario.mitre_tactics.length,  color:'#a78bfa' },
          { label:'IOCs Observed', value: scenario.steps.length,          color:'#38bdf8' },
        ].map(stat => (
          <div key={stat.label} style={{ backgroundColor:'rgba(15,23,42,0.8)',
                border:'1px solid rgba(51,65,85,0.4)', borderRadius:8, padding:'12px' }}>
            <div style={{ color:stat.color, fontSize:'1.8rem', fontWeight:700 }}>{stat.value}</div>
            <div style={{ color:'#64748b', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{ backgroundColor:'rgba(56,189,248,0.06)', border:'1px solid rgba(56,189,248,0.2)',
                    borderRadius:8, padding:'1rem', marginBottom:'1.5rem', textAlign:'left' }}>
        <div style={{ color:'#38bdf8', fontWeight:700, marginBottom:8, fontSize:'0.85rem' }}>
          📋 MITRE ATT&CK Tactics Observed
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {scenario.mitre_tactics.map(t => (
            <span key={t} style={{ backgroundColor:'rgba(167,139,250,0.12)', color:'#a78bfa',
                                   border:'1px solid rgba(167,139,250,0.3)', borderRadius:4,
                                   padding:'3px 10px', fontSize:'0.75rem' }}>{t}</span>
          ))}
        </div>
      </div>
      <button onClick={onReset} style={{
        backgroundColor:'rgba(56,189,248,0.12)', color:'#38bdf8',
        border:'1px solid rgba(56,189,248,0.3)', borderRadius:8,
        padding:'10px 24px', cursor:'pointer', fontSize:'0.9rem',
      }}>
        ↩ Run Another Scenario
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReplayMode() {
  const [selectedKey,    setSelectedKey]    = useState('');
  const [isReplaying,    setIsReplaying]    = useState(false);
  const [isPaused,       setIsPaused]       = useState(false);
  const [speed,          setSpeed]          = useState(1.5);
  const [currentStep,    setCurrentStep]    = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isComplete,     setIsComplete]     = useState(false);
  const timerRef = useRef(null);

  const scenario = SCENARIOS[selectedKey] || null;

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setIsReplaying(false); setIsPaused(false);
    setCurrentStep(null); setCompletedSteps([]); setIsComplete(false);
  }, []);

  const runStep = useCallback((steps, idx) => {
    if (idx >= steps.length) { setIsComplete(true); setIsReplaying(false); return; }
    const step = steps[idx];
    setCurrentStep(step.id);
    const delay = (3500 / speed);
    timerRef.current = setTimeout(() => {
      setCompletedSteps(prev => [...prev, step.id]);
      runStep(steps, idx + 1);
    }, delay);
  }, [speed]);

  const startReplay = () => {
    if (!scenario) return;
    reset();
    setIsReplaying(true);
    setIsPaused(false);
    setTimeout(() => runStep(scenario.steps, 0), 300);
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      const remaining = scenario.steps.filter(s => !completedSteps.includes(s.id));
      if (remaining.length) runStep(scenario.steps, scenario.steps.indexOf(remaining[0]));
    } else {
      setIsPaused(true);
      clearTimeout(timerRef.current);
    }
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <>
      <style>{`
        @keyframes fadeIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes stepIn   { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:none} }
        @keyframes logLine  { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:none} }
        @keyframes pulseRed { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
      `}</style>

      <div style={{ minHeight:'100vh', backgroundColor:'#0a0e1a', padding:'1.5rem', color:'#f8fafc' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
          <div>
            <h1 style={{ margin:0, color:'#f8fafc', fontSize:'1.4rem', fontWeight:700 }}>
              ⚔️ SOC Attack Scenario Simulator
            </h1>
            <p style={{ margin:'4px 0 0', color:'#64748b', fontSize:'0.85rem' }}>
              Replay real-world attack chains step-by-step with live log simulation and analyst guidance
            </p>
          </div>
          <a href="/" style={{ color:'#38bdf8', fontSize:'0.85rem', textDecoration:'none',
                               border:'1px solid rgba(56,189,248,0.3)', padding:'6px 14px', borderRadius:6 }}>
            ← Dashboard
          </a>
        </div>

        {isComplete && scenario ? (
          <CompletionReport scenario={scenario} onReset={() => { reset(); setSelectedKey(''); }} />
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:'1.5rem', alignItems:'start' }}>

            {/* Left panel — controls */}
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Scenario selector */}
              <div style={{ backgroundColor:'#0f172a', border:'1px solid rgba(51,65,85,0.5)', borderRadius:10, padding:'1rem' }}>
                <div style={{ color:'#94a3b8', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                  Select Scenario
                </div>
                {Object.entries(SCENARIOS).map(([key, sc]) => {
                  const active = selectedKey === key;
                  const scSev  = s(sc.severity);
                  return (
                    <div key={key} onClick={() => { if (!isReplaying) { setSelectedKey(key); reset(); } }}
                      style={{ padding:'10px 12px', borderRadius:8, marginBottom:6, cursor: isReplaying ? 'not-allowed' : 'pointer',
                               backgroundColor: active ? scSev.bg : 'rgba(15,23,42,0.6)',
                               border:`1px solid ${active ? scSev.color+'40' : '#1e293b'}`,
                               transition:'all 0.2s', opacity: isReplaying && !active ? 0.4 : 1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ color: active ? scSev.color : '#94a3b8', fontWeight:600, fontSize:'0.82rem' }}>
                          {sc.name}
                        </span>
                        <span style={{ fontSize:'0.65rem', padding:'1px 6px', borderRadius:4,
                                       backgroundColor:`${scSev.color}18`, color:scSev.color }}>
                          {sc.severity}
                        </span>
                      </div>
                      <div style={{ color:'#475569', fontSize:'0.72rem', lineHeight:1.3 }}>{sc.description}</div>
                      <div style={{ color:'#334155', fontSize:'0.68rem', marginTop:4 }}>
                        {sc.steps.length} phases • {sc.mitre_tactics.length} MITRE tactics
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Speed control */}
              <div style={{ backgroundColor:'#0f172a', border:'1px solid rgba(51,65,85,0.5)', borderRadius:10, padding:'1rem' }}>
                <div style={{ color:'#94a3b8', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                  Replay Speed: <span style={{ color:'#38bdf8' }}>{speed}x</span>
                </div>
                <input type="range" min="0.5" max="5" step="0.5" value={speed}
                  onChange={e => setSpeed(parseFloat(e.target.value))} disabled={isReplaying}
                  style={{ width:'100%', accentColor:'#38bdf8' }} />
                <div style={{ display:'flex', justifyContent:'space-between', color:'#334155', fontSize:'0.68rem', marginTop:4 }}>
                  <span>0.5x (slow)</span><span>5x (fast)</span>
                </div>
              </div>

              {/* Play controls */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {!isReplaying ? (
                  <button onClick={startReplay} disabled={!selectedKey} style={{
                    padding:'12px', borderRadius:8, border:'none', cursor: selectedKey ? 'pointer' : 'not-allowed',
                    backgroundColor: selectedKey ? '#ef4444' : '#1e293b',
                    color: selectedKey ? '#fff' : '#475569', fontWeight:700, fontSize:'0.9rem',
                    boxShadow: selectedKey ? '0 0 20px rgba(239,68,68,0.3)' : 'none',
                    animation: selectedKey ? 'pulseRed 2s infinite' : 'none',
                    transition:'all 0.2s',
                  }}>
                    ▶ Start Replay
                  </button>
                ) : (
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={togglePause} style={{
                      flex:1, padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
                      backgroundColor:'rgba(234,179,8,0.12)', color:'#eab308',
                      border:'1px solid rgba(234,179,8,0.3)', fontWeight:600,
                    }}>
                      {isPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    <button onClick={reset} style={{
                      padding:'10px 14px', borderRadius:8, border:'1px solid rgba(239,68,68,0.3)',
                      backgroundColor:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer',
                    }}>
                      ■ Stop
                    </button>
                  </div>
                )}
              </div>

              {/* Score */}
              {scenario && (isReplaying || completedSteps.length > 0) && (
                <ScorePanel completedSteps={completedSteps} totalSteps={scenario.steps.length} scenario={scenario} />
              )}

              {/* MITRE legend */}
              {scenario && (
                <div style={{ backgroundColor:'#0f172a', border:'1px solid rgba(51,65,85,0.4)', borderRadius:10, padding:'1rem' }}>
                  <div style={{ color:'#94a3b8', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                    MITRE ATT&CK Tactics
                  </div>
                  {scenario.mitre_tactics.map(t => (
                    <span key={t} style={{ display:'inline-block', margin:'3px', fontSize:'0.68rem',
                                           padding:'2px 8px', borderRadius:4, backgroundColor:'rgba(167,139,250,0.1)',
                                           color:'#a78bfa', border:'1px solid rgba(167,139,250,0.25)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right panel — timeline */}
            <div>
              {!scenario ? (
                <div style={{ backgroundColor:'#0f172a', border:'1px dashed rgba(51,65,85,0.5)',
                              borderRadius:12, padding:'4rem', textAlign:'center' }}>
                  <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🎯</div>
                  <h3 style={{ color:'#475569', margin:'0 0 0.5rem' }}>Select a Scenario</h3>
                  <p style={{ color:'#334155', fontSize:'0.85rem', margin:0 }}>
                    Choose an attack scenario from the left panel to begin the simulation.
                    Watch real attack events unfold with analyst guidance at each phase.
                  </p>
                </div>
              ) : (
                <>
                  {/* Phase progress bar */}
                  <PhaseBar steps={scenario.steps} currentStep={currentStep} completedSteps={completedSteps} />

                  {/* Waiting state */}
                  {!isReplaying && completedSteps.length === 0 && (
                    <div style={{ backgroundColor:'#0f172a', border:'1px solid rgba(51,65,85,0.4)',
                                  borderRadius:10, padding:'2rem', textAlign:'center', marginBottom:'1rem' }}>
                      <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>
                        {s(scenario.severity).icon}
                      </div>
                      <div style={{ color:'#94a3b8', fontWeight:600, marginBottom:6 }}>{scenario.name}</div>
                      <div style={{ color:'#475569', fontSize:'0.82rem', marginBottom:8 }}>{scenario.description}</div>
                      <div style={{ color:'#334155', fontSize:'0.75rem' }}>
                        Threat Actor: <span style={{ color:'#f97316' }}>{scenario.threat_actor}</span>
                        {' · '}{scenario.steps.length} phases to simulate
                      </div>
                    </div>
                  )}

                  {/* Step cards */}
                  {scenario.steps.map(step => {
                    const isDone   = completedSteps.includes(step.id);
                    const isActive = currentStep === step.id;
                    return (
                      <StepCard key={step.id} step={step} isActive={isActive} isDone={isDone} />
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

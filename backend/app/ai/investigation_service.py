"""
AI Investigation Service
=========================
Orchestrates all AI analysis features for the Investigation Center.
Called by the API layer; uses Ollama for inference and evidence_parser for parsing.
"""

import asyncio
import logging
from typing import List, Optional

from app.ai.ollama_client   import generate, check_ollama_status
from app.ai.evidence_parser import parse_evidence, summarise_events
from app.ai.mitre_mapping   import get_mitre, get_plain_english, get_all_techniques_for_events
from app.ai.prompt_templates import (
    SYSTEM_ROLE, ANALYSIS_PROMPT, STORY_PROMPT, BEGINNER_PROMPT,
    CHAT_PROMPT, TECHNICAL_REPORT_PROMPT, MANAGEMENT_REPORT_PROMPT,
    EDUCATIONAL_REPORT_PROMPT,
)

logger = logging.getLogger("soc_dashboard.ai_investigation")


class InvestigationService:

    # ── 1. Full Investigation ─────────────────────────────────────────────────
    async def investigate(
        self,
        filename: str,
        content:  str,
        model:    str = "llama3",
    ) -> dict:
        """
        Main entry point. Parses the file, runs all AI analyses, returns
        the complete investigation result used by the frontend.
        """
        events  = parse_evidence(filename, content)
        summary = summarise_events(events)
        mitre   = get_all_techniques_for_events(events)

        # Plain-English per attack type
        plain_english = {
            atype: get_plain_english(atype)
            for atype in summary["attack_types"]
        }

        # AI analysis (runs concurrently to save time)
        analysis_task = asyncio.create_task(
            self._run_analysis(summary, model)
        )
        story_task = asyncio.create_task(
            self._run_story(summary["events_text"], model)
        ) if len(events) > 1 else None

        analysis = await analysis_task
        story    = await story_task if story_task else "Insufficient events to reconstruct attack story."

        # Build per-technique recommendation list
        recommendations = {}
        for technique in mitre:
            atype = technique.get("alert_type", "")
            entry = get_mitre(atype)
            if entry:
                recommendations[atype] = entry["remediation"]

        return {
            "filename":        filename,
            "event_count":     summary["event_count"],
            "attack_types":    summary["attack_types"],
            "source_ips":      summary["source_ips"],
            "target_ips":      summary["target_ips"],
            "severity":        summary["severity"],
            "timeline":        summary["timeline"],
            "events":          events,
            "mitre_mapping":   mitre,
            "plain_english":   plain_english,
            "recommendations": recommendations,
            "ai_analysis":     analysis,
            "attack_story":    story,
        }

    # ── 2. Attack Story ───────────────────────────────────────────────────────
    async def get_story(self, events_text: str, model: str = "llama3") -> str:
        return await self._run_story(events_text, model)

    # ── 3. Beginner Explanation ───────────────────────────────────────────────
    async def explain_beginner(self, technical_event: str, model: str = "llama3") -> str:
        prompt = BEGINNER_PROMPT.format(technical_event=technical_event)
        return await generate(prompt, system=SYSTEM_ROLE, model=model, temperature=0.4)

    # ── 4. Incident Chat ──────────────────────────────────────────────────────
    async def chat(
        self,
        question:         str,
        incident_context: str,
        model:            str = "llama3",
    ) -> str:
        prompt = CHAT_PROMPT.format(
            incident_context=incident_context,
            question=question,
        )
        return await generate(prompt, system=SYSTEM_ROLE, model=model, temperature=0.2)

    # ── 7. Multi-View Reports ─────────────────────────────────────────────────
    async def generate_report(
        self,
        investigation: dict,
        view:          str   = "technical",
        model:         str   = "llama3",
    ) -> str:
        mitre_text = "\n".join(
            f"- {t['technique_id']} {t['technique_name']} ({t['tactic']})"
            for t in investigation.get("mitre_mapping", [])
        )
        evidence_text = investigation.get("events", [{}])[0].get("raw", {})

        if view == "technical":
            prompt = TECHNICAL_REPORT_PROMPT.format(
                evidence=investigation.get("ai_analysis", ""),
                mitre_mapping=mitre_text or "None identified",
            )
        elif view == "management":
            prompt = MANAGEMENT_REPORT_PROMPT.format(
                summary=investigation.get("ai_analysis", "")
            )
        else:  # educational
            prompt = EDUCATIONAL_REPORT_PROMPT.format(
                evidence=investigation.get("ai_analysis", ""),
                attack_types=", ".join(investigation.get("attack_types", [])),
            )
        return await generate(prompt, system=SYSTEM_ROLE, model=model, temperature=0.3)

    # ── Internal helpers ──────────────────────────────────────────────────────
    async def _run_analysis(self, summary: dict, model: str) -> str:
        prompt = ANALYSIS_PROMPT.format(
            evidence=summary["events_text"],
            attack_types=", ".join(summary["attack_types"]) or "Unknown",
            source_ips=", ".join(summary["source_ips"]) or "Not identified",
            target_ips=", ".join(summary["target_ips"]) or "Not identified",
            severity=summary["severity"].upper(),
            timeline=summary["timeline"] or "Not available",
        )
        return await generate(prompt, system=SYSTEM_ROLE, model=model, temperature=0.3)

    async def _run_story(self, events_text: str, model: str) -> str:
        prompt = STORY_PROMPT.format(events=events_text)
        return await generate(prompt, system=SYSTEM_ROLE, model=model, temperature=0.5)

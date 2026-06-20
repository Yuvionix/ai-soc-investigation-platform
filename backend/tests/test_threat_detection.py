"""
Unit tests for the rule-based threat detection thresholds in packet_sniffer.py.

ADDED to close a gap identified during red-team review: prior to this file,
the backend's only automated tests were five smoke tests confirming basic
API reachability (test_api.py). The detection engine's threshold logic —
the core security function of the project — had no automated test coverage
at all; verification had previously relied on manual source-code review only.

These tests exercise _detect_threats() directly, using fresh per-test IP
addresses to avoid cross-test state leakage through the module-level
tracker dictionaries.
"""
import pytest
from app.streaming.packet_sniffer import (
    _detect_threats,
    _SCAN_THRESH, _SCAN_WINDOW,
    _FLOOD_THRESH, _FLOOD_WINDOW,
    _BRUTE_THRESH, _BRUTE_WINDOW,
    _DNS_THRESH, _DNS_WINDOW,
)


def test_port_scan_fires_at_threshold():
    """15 unique destination ports from one source IP must trigger a port_scan alert."""
    src_ip = "10.99.1.1"
    result = None
    for port in range(20000, 20000 + _SCAN_THRESH):
        result = _detect_threats(src_ip, port, "TCP", flags="S")
    assert result is not None
    assert result["threat_type"] == "port_scan"
    assert result["severity"] == "warning"
    assert result["ip_address"] == src_ip


def test_port_scan_does_not_fire_below_threshold():
    """Fewer than the threshold number of unique ports must NOT trigger an alert."""
    src_ip = "10.99.1.2"
    result = None
    for port in range(21000, 21000 + _SCAN_THRESH - 1):
        result = _detect_threats(src_ip, port, "TCP", flags="S")
    assert result is None


def test_ddos_flood_fires_at_threshold():
    """200 packets from one source IP within the flood window must trigger a ddos alert."""
    src_ip = "10.99.2.1"
    result = None
    for _ in range(_FLOOD_THRESH):
        result = _detect_threats(src_ip, 443, "TCP", flags="A")
    assert result is not None
    assert result["threat_type"] == "ddos"
    assert result["severity"] == "critical"


def test_brute_force_ssh_fires_at_threshold():
    """10 SYN packets to port 22 from one source IP must trigger a brute_force alert."""
    src_ip = "10.99.3.1"
    result = None
    for _ in range(_BRUTE_THRESH):
        result = _detect_threats(src_ip, 22, "TCP", flags="S")
    assert result is not None
    assert result["threat_type"] == "brute_force"
    assert "SSH" in result["message"]


def test_brute_force_rdp_fires_at_threshold():
    """10 SYN packets to port 3389 from one source IP must trigger a brute_force alert."""
    src_ip = "10.99.3.2"
    result = None
    for _ in range(_BRUTE_THRESH):
        result = _detect_threats(src_ip, 3389, "TCP", flags="S")
    assert result is not None
    assert result["threat_type"] == "brute_force"
    assert "RDP" in result["message"]


def test_brute_force_ignores_non_syn_packets():
    """Packets without the SYN flag to port 22 must NOT count toward the brute-force tracker."""
    src_ip = "10.99.3.3"
    result = None
    for _ in range(_BRUTE_THRESH + 5):
        result = _detect_threats(src_ip, 22, "TCP", flags="A")  # ACK only, no SYN
    assert result is None


def test_dns_exfiltration_fires_at_threshold():
    """50 DNS queries within the window from one source IP must trigger a dns_exfil alert."""
    src_ip = "10.99.4.1"
    result = None
    for _ in range(_DNS_THRESH):
        result = _detect_threats(src_ip, 53, "DNS")
    assert result is not None
    assert result["threat_type"] == "dns_exfil"
    assert result["severity"] == "warning"


def test_unrelated_traffic_produces_no_alert():
    """A single ordinary packet must not trigger any detection rule."""
    result = _detect_threats("10.99.5.1", 443, "TCP", flags="S")
    assert result is None


def test_each_source_ip_tracked_independently():
    """Port-scan activity from IP A must not contribute to IP B's counters."""
    ip_a, ip_b = "10.99.6.1", "10.99.6.2"
    for port in range(22000, 22000 + _SCAN_THRESH - 1):
        _detect_threats(ip_a, port, "TCP", flags="S")
    # ip_b sends a single packet on a port ip_a already used — must not inherit ip_a's count
    result = _detect_threats(ip_b, 22000, "TCP", flags="S")
    assert result is None

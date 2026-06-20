"""
Data validation utilities
"""
from typing import Any
import re


class Validators:
    """Collection of validation functions"""
    
    @staticmethod
    def validate_severity(severity: str) -> bool:
        """Validate severity level"""
        valid_severities = ["low", "medium", "high", "critical", "info", "warning", "error"]
        return severity.lower() in valid_severities
    
    @staticmethod
    def validate_status(status: str) -> bool:
        """Validate status value"""
        valid_statuses = ["open", "in_progress", "closed", "resolved", "investigating"]
        return status.lower() in valid_statuses
    
    @staticmethod
    def validate_ip_address(ip: str) -> bool:
        """Validate IP address format"""
        ipv4_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        ipv6_pattern = r'^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$'
        
        if re.match(ipv4_pattern, ip):
            parts = ip.split('.')
            return all(0 <= int(part) <= 255 for part in parts)
        
        return bool(re.match(ipv6_pattern, ip))
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(email_pattern, email))
    
    @staticmethod
    def sanitize_input(data: str) -> str:
        """Sanitize user input"""
        # Remove potentially dangerous characters
        dangerous_chars = ['<', '>', '"', "'", '&', ';']
        sanitized = data
        for char in dangerous_chars:
            sanitized = sanitized.replace(char, '')
        return sanitized.strip()


# Global validator instance
validators = Validators()

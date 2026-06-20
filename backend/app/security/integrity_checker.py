"""
Integrity checker for database and file verification
"""
import json
import os
from pathlib import Path
from typing import Dict
from datetime import datetime

from app.security.hashing import hash_manager
from app.config import settings


class IntegrityChecker:
    """Check and maintain data integrity"""
    
    def __init__(self, hash_dir: str = "./data/integrity_hashes"):
        """Initialize integrity checker"""
        self.hash_dir = Path(hash_dir)
        self.hash_dir.mkdir(parents=True, exist_ok=True)
    
    def compute_database_hash(self, db_path: str) -> str:
        """Compute hash of database file"""
        if not os.path.exists(db_path):
            return ""
        return hash_manager.hash_file(db_path)
    
    def store_hash(self, identifier: str, hash_value: str) -> None:
        """Store hash for later verification"""
        hash_file = self.hash_dir / f"{identifier}.json"
        hash_data = {
            "hash": hash_value,
            "timestamp": datetime.now().isoformat(),
            "algorithm": hash_manager.algorithm
        }
        with open(hash_file, 'w') as f:
            json.dump(hash_data, f, indent=2)
    
    def load_hash(self, identifier: str) -> Dict:
        """Load stored hash"""
        hash_file = self.hash_dir / f"{identifier}.json"
        if not hash_file.exists():
            return {}
        with open(hash_file, 'r') as f:
            return json.load(f)
    
    def verify_integrity(self, identifier: str, current_data: str) -> bool:
        """Verify data integrity against stored hash"""
        if not settings.ENABLE_INTEGRITY_CHECK:
            return True
        
        stored_hash_data = self.load_hash(identifier)
        if not stored_hash_data:
            return False
        
        current_hash = hash_manager.hash_data(current_data)
        return current_hash == stored_hash_data.get("hash")
    
    def create_integrity_report(self) -> Dict:
        """Generate integrity verification report"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "checks": []
        }
        
        # Check database integrity
        db_path = "./data/soc_database.db"
        if os.path.exists(db_path):
            stored = self.load_hash("database")
            current = self.compute_database_hash(db_path)
            report["checks"].append({
                "item": "database",
                "verified": stored.get("hash") == current if stored else None,
                "current_hash": current
            })
        
        return report


# Global integrity checker instance
integrity_checker = IntegrityChecker()

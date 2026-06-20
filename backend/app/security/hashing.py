"""
Hashing utilities for data integrity
"""
import hashlib
import json
from typing import Any
from app.config import settings


class HashManager:
    """Manager for data hashing and integrity checking"""
    
    def __init__(self, algorithm: str = None):
        """Initialize hash manager"""
        self.algorithm = algorithm or settings.HASH_ALGORITHM
    
    def hash_data(self, data: Any) -> str:
        """Generate hash for data"""
        if isinstance(data, dict):
            data_str = json.dumps(data, sort_keys=True)
        else:
            data_str = str(data)
        
        hasher = hashlib.new(self.algorithm)
        hasher.update(data_str.encode())
        return hasher.hexdigest()
    
    def hash_file(self, file_path: str) -> str:
        """Generate hash for file"""
        hasher = hashlib.new(self.algorithm)
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def verify_hash(self, data: Any, expected_hash: str) -> bool:
        """Verify data integrity"""
        computed_hash = self.hash_data(data)
        return computed_hash == expected_hash


# Global hash manager instance
hash_manager = HashManager()

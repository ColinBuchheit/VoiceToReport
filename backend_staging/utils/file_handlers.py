import os
import tempfile
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def save_temp_file(data: bytes, filename: str) -> str:
    """
    Save bytes data to a temporary file
    """
    try:
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"voice_report_{os.getpid()}_{filename}")
        
        with open(temp_path, "wb") as f:
            f.write(data)
            
        logger.info(f"Saved temporary file: {temp_path}")
        return temp_path
        
    except Exception as e:
        logger.error(f"Error saving temp file: {str(e)}")
        raise

def cleanup_temp_file(filepath: str) -> None:
    """
    Remove temporary file
    """
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"Cleaned up temp file: {filepath}")
    except Exception as e:
        logger.warning(f"Error cleaning up temp file: {str(e)}")
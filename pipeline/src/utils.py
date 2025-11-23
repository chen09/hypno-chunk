import os
import logging

def setup_logging(log_level=logging.INFO):
    """
    Configure logging for the project.
    """
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

def ensure_dir(directory: str):
    """
    Ensure that a directory exists.
    """
    if not os.path.exists(directory):
        os.makedirs(directory)

def read_file(file_path: str) -> str:
    """
    Read content from a file.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

def save_json(data: dict, file_path: str):
    """
    Save dictionary data to a JSON file.
    """
    import json
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

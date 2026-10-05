import logging
import sys
from pathlib import Path


class Logger:
    def __init__(self, name: str, level: int = logging.DEBUG):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        
        log_format = logging.Formatter(
            fmt="%(asctime)s - %(levelname)-8s - %(name)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(log_format)
        self.logger.addHandler(console_handler)

    def get_logger(self) -> logging.Logger:
        return self.logger
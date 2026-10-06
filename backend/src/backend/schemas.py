from dataclasses import dataclass

@dataclass
class RaspberryPiInfo:
    hostname: str
    model: str
    serial_number: str | None
    local_ip: str | None
    uptime: str
    cpu_usage_percent: float
    cpu_temperature_celsius: float | None
    memory_usage_percent: float
    storage_usage_percent: float
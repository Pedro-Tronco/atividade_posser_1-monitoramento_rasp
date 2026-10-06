from datetime import datetime, timedelta
import platform
import socket
from pathlib import Path

import psutil

from .schemas import (
    RaspberryPiInfo,
)


def _get_local_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return None


def _get_raspberry_model() -> str:
    model_path = Path("/proc/device-tree/model")

    try:
        return model_path.read_text().rstrip("\x00\n")
    except OSError:
        return "Unknown"


def _get_raspberry_serial() -> str | None:
    serial_path = Path("/sys/firmware/devicetree/base/serial-number")

    try:
        return serial_path.read_text().rstrip("\x00\n")
    except OSError:
        return None


def _get_cpu_temperature() -> float | None:
    thermal_base = Path("/sys/class/thermal")

    try:
        zones = thermal_base.glob("thermal_zone*/temp")

        for temp_path in zones:
            temperature = int(temp_path.read_text().strip()) / 1000

            if -20 <= temperature <= 120:
                return temperature

    except (OSError, ValueError):
        pass

    return None


def get_raspberry_pi_info() -> RaspberryPiInfo:
    boot_time = datetime.fromtimestamp(psutil.boot_time())
    uptime = str(datetime.now() - boot_time)

    return RaspberryPiInfo(
        hostname=platform.node(),
        model=_get_raspberry_model(),
        serial_number=_get_raspberry_serial(),
        local_ip=_get_local_ip(),
        uptime=uptime,
        cpu_usage_percent=psutil.cpu_percent(interval=0.5),
        cpu_temperature_celsius=_get_cpu_temperature(),
        memory_usage_percent=psutil.virtual_memory().percent,
        storage_usage_percent=psutil.disk_usage("/").percent,
    )


if __name__ == "__main__":
    info = get_raspberry_pi_info()
    print(info)


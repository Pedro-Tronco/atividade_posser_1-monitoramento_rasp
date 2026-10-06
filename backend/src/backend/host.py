import tornado.web
import tornado.websocket
from tornado import gen
from logging import Logger
from dataclasses import asdict

from .info_gatherer import get_raspberry_pi_info


class HostWebSocket(tornado.websocket.WebSocketHandler):

    def initialize(self, logger: Logger):
        self._logger = logger
        self._is_connected: bool = False

    async def open(self) -> None:
        self._logger.info("Client connected")
        self._is_connected = True

        try:
            while True:
                await self.write_message(asdict(get_raspberry_pi_info()))
                await gen.sleep(1)
        except tornado.websocket.WebSocketClosedError:
            pass

    def on_close(self) -> None:
        self._logger.info("Client disconnected")
        self._is_connected = False

    def check_origin(self, origin):
        return True


def make_app(logger: Logger):
    return tornado.web.Application(
        [
            (r"/websocket", HostWebSocket, dict(logger=logger)),
        ]
    )
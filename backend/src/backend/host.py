import tornado.web
import tornado.websocket
from tornado import gen
from logging import Logger


class HostWebSocket(tornado.websocket.WebSocketHandler):    
    def initialize(self, logger: Logger):
        self._logger = logger
        
        self.is_connected: bool = False
    
    def open(self):
        self._logger.info('Client connected')
        self.is_connected = True
        
        while 

    def on_close(self):
        self._logger.info('Client disconnected')
        self.is_connected = False

    def check_origin(self, origin):
        return True

def make_app(logger: Logger):
    return tornado.web.Application([
        (r"/websocket", HostWebSocket, dict(logger=logger)),
    ])
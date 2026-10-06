import tornado.ioloop

from .host import make_app

from .logger import Logger

if __name__ == "__main__":
    logger = Logger('backend').get_logger()
    app = make_app(logger=logger)
    app.listen(8000, address='0.0.0.0')
    logger.info(f'Websocket started')
    tornado.ioloop.IOLoop.current().start()
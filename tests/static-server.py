# Static file server for the Playwright suite: `python -m http.server` with a
# real listen backlog. The stock server queues only 5 connections, so parallel
# workers loading ~40 files each got ECONNREFUSED on random scripts, a deferred
# module never ran, and openApp() timed out waiting for it.
#
#   python static-server.py <port> <directory>
import functools
import http.server
import sys


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256
    daemon_threads = True


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


port = int(sys.argv[1])
handler = functools.partial(QuietHandler, directory=sys.argv[2])
Server(("127.0.0.1", port), handler).serve_forever()

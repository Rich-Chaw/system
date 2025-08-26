#!/usr/bin/env python3
"""
FINDER_ND Client Launcher
Simple HTTP server for serving the client files
"""

import os
import sys
import argparse
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading
import time

class ClientHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        client_dir = os.path.join(os.path.dirname(__file__), 'client')
        super().__init__(*args, directory=client_dir, **kwargs)
    
    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def main():
    parser = argparse.ArgumentParser(description='FINDER_ND Client Server')
    parser.add_argument('--host', default='localhost', help='Host address')
    parser.add_argument('--port', type=int, default=8080, help='Port number')
    parser.add_argument('--no-browser', action='store_true', help='Don\'t open browser automatically')
    
    args = parser.parse_args()
    
    # Check if client directory exists
    client_dir = os.path.join(os.path.dirname(__file__), 'client')
    if not os.path.exists(client_dir):
        print(f"Error: Client directory not found: {client_dir}")
        sys.exit(1)
    
    # Don't change directory, let the handler handle it
    
    # Create server
    server = HTTPServer((args.host, args.port), ClientHandler)
    
    print(f"FINDER_ND Client Server starting...")
    print(f"Serving at http://{args.host}:{args.port}")
    print(f"Press Ctrl+C to stop the server")
    
    # Open browser after a short delay
    if not args.no_browser:
        def open_browser():
            time.sleep(1)
            webbrowser.open(f'http://{args.host}:{args.port}')
        
        browser_thread = threading.Thread(target=open_browser)
        browser_thread.daemon = True
        browser_thread.start()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped by user")
        server.shutdown()

if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
FINDER_ND System Launcher
Starts both server and client components
"""

import os
import sys
import subprocess
import time
import signal
import argparse
from threading import Thread

class SystemLauncher:
    def __init__(self):
        self.server_process = None
        self.client_process = None
        self.running = True
    
    def start_server(self, host='0.0.0.0', port=5000, config='development'):
        """Start the server process"""
        print(f"Starting FINDER_ND server on {host}:{port}...")
        
        cmd = [
            sys.executable, './system/run_server.py',
            '--config', config,
            '--host', host,
            '--port', str(port)
        ]
        
        try:
            self.server_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1,
                encoding='utf-8'
            )
            
            # Monitor server output
            def monitor_server():
                for line in iter(self.server_process.stdout.readline, ''):
                    if self.running:
                        print(f"[SERVER] {line.rstrip()}")
                    else:
                        break
            
            server_thread = Thread(target=monitor_server, daemon=True)
            server_thread.start()
            
            # Wait a bit for server to start
            time.sleep(3)
            
            if self.server_process.poll() is None:
                print("✓ Server started successfully")
                return True
            else:
                print("✗ Server failed to start")
                return False
                
        except Exception as e:
            print(f"✗ Failed to start server: {e}")
            return False
    
    def start_client(self, host='localhost', port=8080, no_browser=False):
        """Start the client process"""
        print(f"Starting FINDER_ND client on {host}:{port}...")
        
        cmd = [
            sys.executable, './system/run_client.py',
            '--host', host,
            '--port', str(port)
        ]
        
        if no_browser:
            cmd.append('--no-browser')
        
        try:
            self.client_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1,
                encoding='utf-8'
            )
            
            # Monitor client output
            def monitor_client():
                for line in iter(self.client_process.stdout.readline, ''):
                    if self.running:
                        print(f"[CLIENT] {line.rstrip()}")
                    else:
                        break
            
            client_thread = Thread(target=monitor_client, daemon=True)
            client_thread.start()
            
            # Wait a bit for client to start
            time.sleep(2)
            
            if self.client_process.poll() is None:
                print("✓ Client started successfully")
                return True
            else:
                print("✗ Client failed to start")
                return False
                
        except Exception as e:
            print(f"✗ Failed to start client: {e}")
            return False
    
    def stop_all(self):
        """Stop all processes"""
        print("\nStopping FINDER_ND system...")
        self.running = False
        
        if self.server_process:
            try:
                self.server_process.terminate()
                self.server_process.wait(timeout=5)
                print("✓ Server stopped")
            except subprocess.TimeoutExpired:
                self.server_process.kill()
                print("✓ Server force stopped")
            except Exception as e:
                print(f"✗ Error stopping server: {e}")
        
        if self.client_process:
            try:
                self.client_process.terminate()
                self.client_process.wait(timeout=5)
                print("✓ Client stopped")
            except subprocess.TimeoutExpired:
                self.client_process.kill()
                print("✓ Client force stopped")
            except Exception as e:
                print(f"✗ Error stopping client: {e}")
    
    def check_prerequisites(self):
        """Check if all prerequisites are met"""
        print("Checking prerequisites...")
        
        # Check if server files exist
        if not os.path.exists('./system/run_server.py'):
            print("✗ Server launcher not found")
            return False
        
        if not os.path.exists('./system/server/app.py'):
            print("✗ Server application not found")
            return False
        
        # Check if client files exist
        if not os.path.exists('./system/run_client.py'):
            print("✗ Client launcher not found")
            return False
        
        if not os.path.exists('./system/client/index.html'):
            print("✗ Client application not found")
            return False
        
        # Check if models directory exists
        models_dir = './AAA-NetDQN/code/models'
        if not os.path.exists(models_dir):
            print(f"⚠ Models directory not found: {models_dir}")
            print("  Please ensure your trained models are available")
        else:
            print("✓ Models directory found")
        
        print("✓ Prerequisites check completed")
        return True

def main():
    parser = argparse.ArgumentParser(description='FINDER_ND System Launcher')
    parser.add_argument('--server-host', default='0.0.0.0', help='Server host address')
    parser.add_argument('--server-port', type=int, default=5000, help='Server port')
    parser.add_argument('--client-host', default='localhost', help='Client host address')
    parser.add_argument('--client-port', type=int, default=8080, help='Client port')
    parser.add_argument('--config', choices=['development', 'production'], 
                       default='development', help='Server configuration')
    parser.add_argument('--no-browser', action='store_true', help='Don\'t open browser')
    parser.add_argument('--server-only', action='store_true', help='Start server only')
    parser.add_argument('--client-only', action='store_true', help='Start client only')
    
    args = parser.parse_args()
    
    launcher = SystemLauncher()
    
    # Setup signal handler for graceful shutdown
    def signal_handler(signum, frame):
        launcher.stop_all()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Check prerequisites
        if not launcher.check_prerequisites():
            print("Prerequisites check failed. Please fix the issues and try again.")
            sys.exit(1)
        
        print("\n" + "="*60)
        print("FINDER_ND Network Dismantling System")
        print("="*60)
        
        success = True
        
        # Start server
        if not args.client_only:
            success &= launcher.start_server(
                host=args.server_host,
                port=args.server_port,
                config=args.config
            )
        
        # Start client
        if not args.server_only and success:
            success &= launcher.start_client(
                host=args.client_host,
                port=args.client_port,
                no_browser=args.no_browser
            )
        
        if success:
            print("\n" + "="*60)
            print("✓ FINDER_ND System is running!")
            print(f"  Server: http://{args.server_host}:{args.server_port}")
            if not args.server_only:
                print(f"  Client: http://{args.client_host}:{args.client_port}")
            print("  Press Ctrl+C to stop the system")
            print("="*60)
            
            # Keep the main process running
            while launcher.running:
                time.sleep(1)
        else:
            print("\n✗ Failed to start FINDER_ND system")
            launcher.stop_all()
            sys.exit(1)

    except KeyboardInterrupt:
        launcher.stop_all()
    except Exception as e:
        print(f"Unexpected error: {e}")
        launcher.stop_all()
        sys.exit(1)

if __name__ == '__main__':
    main()
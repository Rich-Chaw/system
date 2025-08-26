#!/usr/bin/env python3
"""
FINDER_ND Server Launcher
"""

import os
import sys
import argparse
import logging

# Add server directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from server.app import app
from server.config import config

def setup_logging(log_level):
    """Setup logging configuration"""
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

def main():
    parser = argparse.ArgumentParser(description='FINDER_ND Network Dismantling Server')
    parser.add_argument('--config', choices=['development', 'production'], 
                       default='development', help='Configuration mode')
    parser.add_argument('--host', default='0.0.0.0', help='Host address')
    parser.add_argument('--port', type=int, default=5000, help='Port number')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    # Load configuration
    config_class = config[args.config]
    app.config.from_object(config_class)
    
    # Override with command line arguments
    if args.debug:
        app.config['DEBUG'] = True
    
    # Setup logging
    setup_logging(app.config.get('LOG_LEVEL', 'INFO'))
    
    logger = logging.getLogger(__name__)
    logger.info(f"Starting FINDER_ND server in {args.config} mode")
    logger.info(f"Server will run on http://{args.host}:{args.port}")
    
    # Check if models directory exists
    models_dir = app.config.get('MODELS_DIR')
    if not os.path.exists(models_dir):
        logger.warning(f"Models directory not found: {models_dir}")
        logger.warning("Please ensure your trained models are available")
    
    # Run the server
    try:
        app.run(
            host=args.host,
            port=args.port,
            debug=app.config['DEBUG'],
            threaded=True
        )
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
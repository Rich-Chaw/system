"""
Configuration settings for FINDER_ND Server
"""

import os

class Config:
    # Server settings
    HOST = '0.0.0.0'
    PORT = 5000
    DEBUG = True
    
    # Paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    MODELS_DIR = os.path.join(BASE_DIR, '..','AAA-NetDQN', 'code', 'models')
    FINDER_ND_DIR = os.path.join(BASE_DIR, '..','AAA-NetDQN', 'code','FINDER_ND')
    FINDER_CODE_DIR = os.path.join(BASE_DIR, '..','AAA-NetDQN', 'code')
    
    
    # Model settings
    DEFAULT_STEP_RATIO = 0.0025
    DEFAULT_MAX_ITERATIONS = 1000
    MAX_GRAPH_SIZE = 10000  # Maximum number of nodes
    
    # File upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'txt', 'json', 'gml', 'graphml', 'edgelist'}
    
    # Processing settings
    REQUEST_TIMEOUT = 300  # 5 minutes
    ENABLE_CACHING = False
    
    # Logging
    LOG_LEVEL = 'INFO'
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

class ProductionConfig(Config):
    DEBUG = False
    LOG_LEVEL = 'WARNING'
    ENABLE_CACHING = True

class DevelopmentConfig(Config):
    DEBUG = True
    LOG_LEVEL = 'DEBUG'

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
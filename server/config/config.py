"""
Configuration settings for NetworkDismantling Server
"""

import os


class Config:
    # Server settings
    HOST = '0.0.0.0'
    PORT = 5000
    DEBUG = True

    # Paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    MODELS_DIR = os.path.join(BASE_DIR, '..', '..', 'FINDER', 'code', 'FINDER', 'models')

    # File upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    ALLOWED_EXTENSIONS = {'txt', 'json', 'gml', 'graphml', 'edgelist'}

    # Logging
    LOG_LEVEL = 'INFO'
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'


class ProductionConfig(Config):
    DEBUG = False
    LOG_LEVEL = 'WARNING'


class DevelopmentConfig(Config):
    DEBUG = True
    LOG_LEVEL = 'DEBUG'


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

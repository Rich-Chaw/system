/**
 * Client Configuration
 */

const Config = {
    // API Configuration
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api'
        : '/api',
    
    // Request timeout (ms)
    REQUEST_TIMEOUT: 300000, // 5 minutes
    
    // Visualization settings
    VISUALIZATION: {
        DEFAULT_WIDTH: 800,
        DEFAULT_HEIGHT: 600,
        NODE_RADIUS: 5,
        LINK_WIDTH: 1,
        COLORS: {
            NODE_ACTIVE: '#4CAF50',
            NODE_REMOVED: '#f44336',
            NODE_HIGHLIGHTED: '#FFC107',
            LINK_ACTIVE: '#999',
            LINK_REMOVED: '#ddd'
        }
    },
    
    // Graph upload settings
    UPLOAD: {
        MAX_FILE_SIZE: 16 * 1024 * 1024, // 16MB
        ALLOWED_EXTENSIONS: ['txt', 'json', 'gml', 'graphml', 'edgelist']
    },
    
    // Model settings
    MODEL: {
        DEFAULT_STEP_RATIO: 0.0025,
        DEFAULT_MAX_ITERATIONS: 1000
    },
    
    // Debug mode
    DEBUG: window.location.hostname === 'localhost'
};

// Freeze configuration to prevent modifications
Object.freeze(Config);
Object.freeze(Config.VISUALIZATION);
Object.freeze(Config.VISUALIZATION.COLORS);
Object.freeze(Config.UPLOAD);
Object.freeze(Config.MODEL);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}

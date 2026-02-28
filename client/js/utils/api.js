/**
 * API Client Utility
 * Centralized API communication for FINDER_ND system
 */

class APIClient {
    constructor(baseURL = Config.API_BASE_URL) {
        this.baseURL = baseURL;
        this.timeout = Config.REQUEST_TIMEOUT;
    }
    
    /**
     * Make HTTP request with timeout
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    error: `HTTP ${response.status}: ${response.statusText}`
                }));
                throw new Error(error.error || 'Request failed');
            }
            
            return await response.json();
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
    
    /**
     * GET request
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }
    
    /**
     * POST request
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    /**
     * Upload file
     */
    async uploadFile(endpoint, file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const url = `${this.baseURL}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    error: `HTTP ${response.status}: ${response.statusText}`
                }));
                throw new Error(error.error || 'Upload failed');
            }
            
            return await response.json();
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Upload timeout');
            }
            throw error;
        }
    }
    
    // API Endpoints
    
    /**
     * Check server health
     */
    async checkHealth() {
        return this.get('/health');
    }
    
    /**
     * Get available models
     */
    async getModels() {
        return this.get('/models');
    }
    
    /**
     * Upload graph file
     */
    async uploadGraph(file) {
        return this.uploadFile('/upload_graph', file);
    }
    
    /**
     * Generate preset graph
     */
    async generatePresetGraph(graphType, parameters) {
        return this.post('/generate_preset_graph', {
            graph_type: graphType,
            parameters: parameters
        });
    }
    
    /**
     * Dismantle network (single model)
     */
    async dismantleNetwork(graph, modelName, stepRatio, maxIterations) {
        return this.post('/dismantle', {
            graph: graph,
            model_name: modelName,
            step_ratio: stepRatio,
            max_iterations: maxIterations
        });
    }
    
    /**
     * Dismantle network (multiple models)
     */
    async dismantleMultiModel(graph, modelConfigs) {
        return this.post('/dismantle_multi_model', {
            graph: graph,
            models: modelConfigs
        });
    }
    
    /**
     * Evaluate solution
     */
    async evaluateSolution(graph, solution) {
        return this.post('/evaluate_solution', {
            graph: graph,
            solution: solution
        });
    }
}

// Create singleton instance
const api = new APIClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIClient, api };
}

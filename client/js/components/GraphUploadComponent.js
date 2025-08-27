/**
 * Graph Upload Component
 * Handles file upload, manual input, and preset graph generation with tabbed interface
 */
class GraphUploadComponent extends BaseComponent {
    getDefaultOptions() {
        return {
            serverUrl: 'http://localhost:5000',
            supportedFormats: ['.txt', '.json', '.gml', '.graphml'],
            maxFileSize: 10 * 1024 * 1024, // 10MB
            uploadModes: ['file', 'manual', 'preset'],
            presetTypes: {
                barabasi_albert: {
                    name: 'Barabási-Albert (Scale-free)',
                    description: 'Generates a scale-free network using preferential attachment',
                    parameters: {
                        n: { label: 'Number of nodes', type: 'number', min: 3, max: 1000, default: 100 },
                        m: { label: 'Edges to attach from new node', type: 'number', min: 1, max: 10, default: 2 }
                    }
                },
                erdos_renyi: {
                    name: 'Erdős-Rényi (Random)',
                    description: 'Generates a random graph where each edge exists with probability p',
                    parameters: {
                        n: { label: 'Number of nodes', type: 'number', min: 3, max: 1000, default: 100 },
                        p: { label: 'Edge probability', type: 'number', min: 0.001, max: 1, step: 0.001, default: 0.1 }
                    }
                }
            }
        };
    }
    
    init() {
        this.currentGraph = null;
        this.uploadMode = 'file';
        this.currentPresetType = null;
        this.presetParameters = {};
        super.init();
    }
    
    setupEventListeners() {
        super.setupEventListeners();
        
        // Tab switching
        this.setupTabEventListeners();
        
        // File upload
        this.setupFileUploadListeners();
        
        // Manual input
        this.setupManualInputListeners();
        
        // Preset generation
        this.setupPresetGenerationListeners();
        
        // Clear button
        const clearBtn = this.container.querySelector('#clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearGraph();
            });
        }
    }
    
    setupTabEventListeners() {
        const tabs = this.container.querySelectorAll('[data-bs-toggle="tab"]');
        tabs.forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const targetId = e.target.getAttribute('data-bs-target');
                const mode = this.getUploadModeFromTab(targetId);
                this.setUploadMode(mode);
            });
        });
    }
    
    setupFileUploadListeners() {
        const fileInput = this.container.querySelector('#graphFile');
        const dropZone = this.container.querySelector('#uploadDropZone');
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files[0]);
            });
        }
        
        if (dropZone) {
            // Click to browse
            dropZone.addEventListener('click', () => {
                fileInput?.click();
            });
            
            // Drag and drop
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            });
        }
    }
    
    setupManualInputListeners() {
        const manualInput = this.container.querySelector('#graphInput');
        if (manualInput) {
            // Debounce input to avoid excessive processing
            let inputTimeout;
            manualInput.addEventListener('input', (e) => {
                clearTimeout(inputTimeout);
                inputTimeout = setTimeout(() => {
                    this.handleManualInput(e.target.value);
                }, 300); // 300ms debounce
            });
            
            // Add paste event listener for better format detection
            manualInput.addEventListener('paste', (e) => {
                setTimeout(() => {
                    this.detectAndSuggestFormat(e.target.value);
                }, 100);
            });
        }
    }
    
    detectAndSuggestFormat(text) {
        if (!text.trim()) return;
        
        const lines = text.trim().split('\n');
        const firstLine = lines[0].trim();
        
        // Try to detect if it might be JSON
        if (firstLine.startsWith('{') || firstLine.startsWith('[')) {
            this.showFormatSuggestion('JSON format detected. Make sure it follows the expected graph structure.');
            return;
        }
        
        // Check for common edge list patterns
        const parts = firstLine.split(/\s+/);
        if (parts.length >= 2) {
            const hasNumbers = parts.every(part => !isNaN(parseFloat(part)));
            if (hasNumbers) {
                this.showFormatSuggestion('Edge list format detected. Each line should contain two node IDs.');
            } else {
                this.showFormatSuggestion('Text format detected. Node IDs should be numeric for best compatibility.');
            }
        }
    }
    
    showFormatSuggestion(message) {
        const manualTab = this.container.querySelector('#manual-input');
        if (!manualTab) return;
        
        // Remove existing suggestion
        const existingSuggestion = manualTab.querySelector('.format-suggestion');
        if (existingSuggestion) {
            existingSuggestion.remove();
        }
        
        // Add new suggestion
        const suggestion = document.createElement('div');
        suggestion.className = 'alert alert-info format-suggestion mt-2';
        suggestion.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        
        manualTab.appendChild(suggestion);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (suggestion.parentNode) {
                suggestion.parentNode.removeChild(suggestion);
            }
        }, 5000);
    }
    
    setupPresetGenerationListeners() {
        const presetTypeSelect = this.container.querySelector('#presetType');
        const generateBtn = this.container.querySelector('#generatePresetBtn');
        
        if (presetTypeSelect) {
            presetTypeSelect.addEventListener('change', (e) => {
                this.handlePresetTypeChange(e.target.value);
            });
        }
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.handlePresetGeneration();
            });
        }
    }
    
    getUploadModeFromTab(targetId) {
        switch (targetId) {
            case '#file-upload': return 'file';
            case '#manual-input': return 'manual';
            case '#preset-generation': return 'preset';
            default: return 'file';
        }
    }
    
    render() {
        // The HTML structure is already in index.html
        // This method updates the UI state based on current mode and state
        this.updateUploadModeUI();
        this.updateLoadingState();
        this.updateErrorState();
    }
    
    updateUploadModeUI() {
        // Ensure the correct tab is active
        const activeTab = this.container.querySelector(`[data-bs-target="#${this.getTabIdFromMode(this.uploadMode)}"]`);
        if (activeTab && !activeTab.classList.contains('active')) {
            // Programmatically switch to the correct tab
            const tab = new bootstrap.Tab(activeTab);
            tab.show();
        }
        
        // Update preset parameters if in preset mode
        if (this.uploadMode === 'preset' && this.currentPresetType) {
            this.renderPresetParameters();
        }
    }
    
    updateLoadingState() {
        const isLoading = this.state.loading;
        const activeTabPane = this.container.querySelector('.tab-pane.active');
        
        if (activeTabPane) {
            if (isLoading) {
                activeTabPane.classList.add('tab-loading');
            } else {
                activeTabPane.classList.remove('tab-loading');
            }
        }
    }
    
    updateErrorState() {
        const hasError = this.state.error;
        const activeTabPane = this.container.querySelector('.tab-pane.active');
        
        if (activeTabPane) {
            if (hasError) {
                activeTabPane.classList.add('error');
                activeTabPane.classList.remove('success');
            } else if (this.state.graphLoaded) {
                activeTabPane.classList.add('success');
                activeTabPane.classList.remove('error');
            } else {
                activeTabPane.classList.remove('error', 'success');
            }
        }
    }
    
    getTabIdFromMode(mode) {
        switch (mode) {
            case 'file': return 'file-upload';
            case 'manual': return 'manual-input';
            case 'preset': return 'preset-generation';
            default: return 'file-upload';
        }
    }
    
    async handleFileUpload(file) {
        if (!file) return;
        
        if (!this.validateFile(file)) {
            return;
        }
        
        // Show upload progress
        this.showUploadProgress(0);
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await this.uploadWithProgress(formData, file);
            const data = await response.json();
            
            if (data.success) {
                this.currentGraph = data.graph_data;
                this.setState({ 
                    graphLoaded: true, 
                    graphInfo: data.graph_info,
                    error: null
                });
                
                // Show success feedback
                this.showUploadSuccess(file.name, data.graph_info);
                
                // Emit event for other components
                this.emit('graph:loaded', {
                    graphData: data.graph_data,
                    graphInfo: data.graph_info
                });
                
            } else {
                this.showError('Upload failed: ' + data.error);
            }
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                this.showError('Cannot connect to server. Please check if the server is running.');
            } else {
                this.showError('Upload failed: ' + error.message);
            }
        } finally {
            this.hideUploadProgress();
        }
    }
    
    async uploadWithProgress(formData, file) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    this.showUploadProgress(percentComplete);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({
                        json: () => Promise.resolve(JSON.parse(xhr.responseText))
                    });
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });
            
            xhr.open('POST', `${this.options.serverUrl}/api/upload_graph`);
            xhr.send(formData);
        });
    }
    
    showUploadProgress(percent) {
        const fileUploadTab = this.container.querySelector('#file-upload');
        if (!fileUploadTab) return;
        
        // Remove existing progress if any
        const existingProgress = fileUploadTab.querySelector('.upload-progress');
        if (existingProgress) {
            existingProgress.remove();
        }
        
        // Create progress indicator
        const progressHtml = `
            <div class="upload-progress">
                <div class="progress">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                </div>
                <div class="upload-progress-text">
                    Uploading... ${Math.round(percent)}%
                </div>
            </div>
        `;
        
        fileUploadTab.insertAdjacentHTML('beforeend', progressHtml);
    }
    
    hideUploadProgress() {
        const progressElement = this.container.querySelector('.upload-progress');
        if (progressElement) {
            progressElement.remove();
        }
    }
    
    showUploadSuccess(filename, graphInfo) {
        const fileUploadTab = this.container.querySelector('#file-upload');
        if (!fileUploadTab) return;
        
        const successMessage = document.createElement('div');
        successMessage.className = 'alert alert-success mt-2';
        successMessage.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <strong>Success!</strong> Uploaded "${filename}" - ${graphInfo.num_nodes} nodes, ${graphInfo.num_edges} edges.
        `;
        
        fileUploadTab.appendChild(successMessage);
        
        // Remove the message after 3 seconds
        setTimeout(() => {
            if (successMessage.parentNode) {
                successMessage.parentNode.removeChild(successMessage);
            }
        }, 3000);
    }
    
    handleManualInput(text) {
        if (!text.trim()) {
            this.clearGraph();
            this.hideFeedback();
            return;
        }
        
        try {
            // Try different parsing strategies
            const result = this.parseManualInput(text);
            
            // Show real-time feedback
            this.showManualInputFeedback(result.edges.length, result.nodes.size, result.warnings);
            
            if (result.edges.length > 0) {
                const graphData = { edges: result.edges };
                this.currentGraph = graphData;
                
                const graphInfo = {
                    nodes: result.nodes.size,
                    edges: result.edges.length,
                    density: result.nodes.size > 1 ? (2 * result.edges.length) / (result.nodes.size * (result.nodes.size - 1)) : 0,
                    is_connected: this.estimateConnectivity(result.edges, result.nodes)
                };
                
                this.setState({ 
                    graphLoaded: true, 
                    graphInfo: graphInfo,
                    error: null
                });
                
                // Emit event for other components
                this.emit('graph:loaded', {
                    graphData: graphData,
                    graphInfo: graphInfo
                });
            } else {
                // Clear graph but don't show error if user is still typing
                this.currentGraph = null;
                this.setState({ 
                    graphLoaded: false, 
                    graphInfo: null,
                    error: null
                });
            }
        } catch (error) {
            this.showError('Error parsing manual input: ' + error.message);
        }
    }
    
    parseManualInput(text) {
        const lines = text.trim().split('\n');
        const edges = [];
        const nodes = new Set();
        const warnings = [];
        let skippedLines = 0;
        
        // Try to detect if it's JSON first
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            try {
                const jsonData = JSON.parse(text);
                return this.parseJsonInput(jsonData);
            } catch (e) {
                warnings.push('Invalid JSON format, trying as edge list');
            }
        }
        
        // Parse as edge list
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and comments
            if (!line || line.startsWith('#') || line.startsWith('//')) {
                continue;
            }
            
            const parts = line.split(/[\s,;]+/); // Support space, comma, or semicolon separators
            
            if (parts.length >= 2) {
                // Try to parse as numbers first
                let node1 = parseInt(parts[0]);
                let node2 = parseInt(parts[1]);
                
                // If not numbers, use as strings but warn
                if (isNaN(node1) || isNaN(node2)) {
                    node1 = parts[0];
                    node2 = parts[1];
                    if (warnings.length === 0) {
                        warnings.push('Non-numeric node IDs detected');
                    }
                }
                
                edges.push([node1, node2]);
                nodes.add(node1);
                nodes.add(node2);
            } else if (parts.length === 1 && !isNaN(parseInt(parts[0]))) {
                // Single node (isolated)
                nodes.add(parseInt(parts[0]));
            } else {
                skippedLines++;
            }
        }
        
        if (skippedLines > 0) {
            warnings.push(`Skipped ${skippedLines} invalid lines`);
        }
        
        return { edges, nodes, warnings };
    }
    
    parseJsonInput(jsonData) {
        const edges = [];
        const nodes = new Set();
        const warnings = [];
        
        if (jsonData.edges && Array.isArray(jsonData.edges)) {
            jsonData.edges.forEach(edge => {
                if (Array.isArray(edge) && edge.length >= 2) {
                    edges.push([edge[0], edge[1]]);
                    nodes.add(edge[0]);
                    nodes.add(edge[1]);
                } else if (edge.source !== undefined && edge.target !== undefined) {
                    edges.push([edge.source, edge.target]);
                    nodes.add(edge.source);
                    nodes.add(edge.target);
                }
            });
        }
        
        if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
            jsonData.nodes.forEach(node => {
                if (typeof node === 'object' && node.id !== undefined) {
                    nodes.add(node.id);
                } else {
                    nodes.add(node);
                }
            });
        }
        
        return { edges, nodes, warnings };
    }
    
    showManualInputFeedback(edgeCount, nodeCount, warnings = []) {
        const feedback = this.container.querySelector('#manualInputFeedback');
        
        if (feedback) {
            // Add additional feedback based on graph size
            let alertClass = 'alert-info';
            let additionalInfo = '';
            
            if (edgeCount === 0 && nodeCount === 0) {
                alertClass = 'alert-secondary';
                additionalInfo = ' - Enter edge data to see preview';
            } else if (edgeCount === 0) {
                alertClass = 'alert-warning';
                additionalInfo = ' - No valid edges detected';
            } else if (nodeCount > 1000) {
                alertClass = 'alert-warning';
                additionalInfo = ' - Large graph detected, processing may take time';
            } else if (edgeCount > 0 && nodeCount > 0) {
                alertClass = 'alert-success';
                const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;
                additionalInfo = ` - Density: ${density.toFixed(3)}`;
            }
            
            // Include warnings if any
            let warningText = '';
            if (warnings.length > 0) {
                warningText = `<br><small class="text-warning"><i class="fas fa-exclamation-triangle"></i> ${warnings.join(', ')}</small>`;
            }
            
            feedback.innerHTML = `
                <div class="alert ${alertClass}">
                    <small>
                        <strong>Preview:</strong> 
                        <span id="edgeCount">${edgeCount}</span> edges, 
                        <span id="nodeCount">${nodeCount}</span> nodes detected${additionalInfo}
                        ${warningText}
                    </small>
                </div>
            `;
            
            feedback.classList.remove('d-none');
        }
    }
    
    estimateConnectivity(edges, nodes) {
        // Simple connectivity estimation - not perfect but good enough for preview
        if (edges.length === 0 || nodes.size <= 1) return false;
        
        // If we have at least n-1 edges for n nodes, it might be connected
        return edges.length >= nodes.size - 1;
    }
    
    validateFile(file) {
        // Check file size
        if (file.size > this.options.maxFileSize) {
            this.showError(`File size exceeds maximum allowed size of ${this.options.maxFileSize / (1024 * 1024)}MB`);
            return false;
        }
        
        // Check if file is empty
        if (file.size === 0) {
            this.showError('File is empty');
            return false;
        }
        
        // Check file extension
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.options.supportedFormats.includes(extension)) {
            this.showError(`Unsupported file format "${extension}". Supported formats: ${this.options.supportedFormats.join(', ')}`);
            return false;
        }
        
        // Additional validation based on file type
        return this.validateFileType(file, extension);
    }
    
    validateFileType(file, extension) {
        // For now, we'll do basic validation
        // More sophisticated validation could be added here
        
        switch (extension) {
            case '.txt':
                // Edge list files should be text
                if (!file.type.startsWith('text/') && file.type !== '') {
                    this.showError('Text files should have text MIME type');
                    return false;
                }
                break;
            case '.json':
                // JSON files
                if (file.type !== 'application/json' && !file.type.startsWith('text/') && file.type !== '') {
                    this.showError('JSON files should have application/json MIME type');
                    return false;
                }
                break;
            case '.gml':
            case '.graphml':
                // XML-based formats
                if (!file.type.startsWith('text/') && !file.type.startsWith('application/xml') && file.type !== '') {
                    this.showError('GML/GraphML files should be text or XML format');
                    return false;
                }
                break;
        }
        
        return true;
    }
    
    clearGraph() {
        this.currentGraph = null;
        this.setState({ 
            graphLoaded: false, 
            graphInfo: null,
            error: null
        });
        
        // Clear all mode inputs
        this.clearAllInputs();
        
        // Remove visual states from tabs
        const tabPanes = this.container.querySelectorAll('.tab-pane');
        tabPanes.forEach(pane => {
            pane.classList.remove('error', 'success');
        });
        
        // Emit event for other components
        this.emit('graph:cleared');
    }
    
    clearAllInputs() {
        // Clear file input
        const fileInput = this.container.querySelector('#graphFile');
        if (fileInput) fileInput.value = '';
        
        // Clear manual input
        const manualInput = this.container.querySelector('#graphInput');
        if (manualInput) manualInput.value = '';
        this.hideFeedback();
        
        // Clear preset inputs
        const presetSelect = this.container.querySelector('#presetType');
        if (presetSelect) presetSelect.value = '';
        this.currentPresetType = null;
        this.presetParameters = {};
        this.clearPresetParameters();
        this.updateGenerateButtonState();
    }
    
    getCurrentGraph() {
        return this.currentGraph;
    }
    
    setUploadMode(mode) {
        if (this.options.uploadModes.includes(mode)) {
            const previousMode = this.uploadMode;
            this.uploadMode = mode;
            
            // Clear previous input when switching modes
            if (previousMode !== mode) {
                this.clearPreviousInput(previousMode);
            }
            
            this.setState({ uploadMode: mode });
            this.emit('upload:mode-changed', { mode, previousMode });
        }
    }
    
    clearPreviousInput(previousMode) {
        switch (previousMode) {
            case 'file':
                const fileInput = this.container.querySelector('#graphFile');
                if (fileInput) fileInput.value = '';
                break;
            case 'manual':
                const manualInput = this.container.querySelector('#graphInput');
                if (manualInput) manualInput.value = '';
                this.hideFeedback();
                break;
            case 'preset':
                this.currentPresetType = null;
                this.presetParameters = {};
                const presetSelect = this.container.querySelector('#presetType');
                if (presetSelect) presetSelect.value = '';
                this.clearPresetParameters();
                break;
        }
    }
    
    // New methods for preset generation interface
    handlePresetTypeChange(type) {
        this.currentPresetType = type;
        this.presetParameters = {};
        
        if (type) {
            this.renderPresetParameters();
            this.showPresetDescription(type);
        } else {
            this.clearPresetParameters();
        }
        
        this.updateGenerateButtonState();
    }
    
    renderPresetParameters() {
        const parametersContainer = this.container.querySelector('#presetParameters');
        if (!parametersContainer || !this.currentPresetType) return;
        
        const presetConfig = this.options.presetTypes[this.currentPresetType];
        if (!presetConfig) return;
        
        let html = '';
        
        Object.entries(presetConfig.parameters).forEach(([paramName, paramConfig]) => {
            const value = this.presetParameters[paramName] || paramConfig.default;
            html += `
                <div class="parameter-group">
                    <label for="preset_${paramName}" class="form-label">${paramConfig.label}</label>
                    <input type="${paramConfig.type}" 
                           class="form-control" 
                           id="preset_${paramName}" 
                           value="${value}"
                           min="${paramConfig.min || ''}"
                           max="${paramConfig.max || ''}"
                           step="${paramConfig.step || ''}"
                           data-param="${paramName}">
                    <div class="parameter-validation" id="validation_${paramName}"></div>
                </div>
            `;
        });
        
        parametersContainer.innerHTML = html;
        
        // Add event listeners for parameter inputs
        parametersContainer.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.handleParameterChange(e.target.dataset.param, e.target.value);
            });
        });
    }
    
    showPresetDescription(type) {
        const parametersContainer = this.container.querySelector('#presetParameters');
        if (!parametersContainer) return;
        
        const presetConfig = this.options.presetTypes[type];
        if (!presetConfig) return;
        
        const descriptionHtml = `
            <div class="graph-type-description">
                <h6>${presetConfig.name}</h6>
                <p>${presetConfig.description}</p>
            </div>
        `;
        
        parametersContainer.insertAdjacentHTML('afterbegin', descriptionHtml);
    }
    
    clearPresetParameters() {
        const parametersContainer = this.container.querySelector('#presetParameters');
        if (parametersContainer) {
            parametersContainer.innerHTML = '';
        }
    }
    
    handleParameterChange(paramName, value) {
        this.presetParameters[paramName] = value;
        this.validateParameter(paramName, value);
        this.updateGenerateButtonState();
    }
    
    validateParameter(paramName, value) {
        const validationElement = this.container.querySelector(`#validation_${paramName}`);
        if (!validationElement || !this.currentPresetType) return false;
        
        const presetConfig = this.options.presetTypes[this.currentPresetType];
        const paramConfig = presetConfig.parameters[paramName];
        
        const numValue = parseFloat(value);
        let isValid = true;
        let message = '';
        
        if (isNaN(numValue)) {
            isValid = false;
            message = 'Must be a valid number';
        } else if (paramConfig.min !== undefined && numValue < paramConfig.min) {
            isValid = false;
            message = `Must be at least ${paramConfig.min}`;
        } else if (paramConfig.max !== undefined && numValue > paramConfig.max) {
            isValid = false;
            message = `Must be at most ${paramConfig.max}`;
        } else {
            // Additional validation for specific parameter combinations
            if (this.currentPresetType === 'barabasi_albert') {
                if (paramName === 'm') {
                    const nValue = parseFloat(this.presetParameters['n'] || this.options.presetTypes.barabasi_albert.parameters.n.default);
                    if (numValue >= nValue) {
                        isValid = false;
                        message = 'Must be less than number of nodes (n)';
                    }
                }
            }
            
            if (isValid) {
                message = '✓ Valid';
            }
        }
        
        validationElement.textContent = message;
        validationElement.className = `parameter-validation ${isValid ? 'valid' : 'invalid'}`;
        
        return isValid;
    }
    
    updateGenerateButtonState() {
        const generateBtn = this.container.querySelector('#generatePresetBtn');
        if (!generateBtn) return;
        
        const canGenerate = this.currentPresetType && this.areAllParametersValid();
        generateBtn.disabled = !canGenerate;
    }
    
    areAllParametersValid() {
        if (!this.currentPresetType) return false;
        
        const presetConfig = this.options.presetTypes[this.currentPresetType];
        return Object.keys(presetConfig.parameters).every(paramName => {
            const value = this.presetParameters[paramName];
            return value !== undefined && this.validateParameter(paramName, value);
        });
    }
    
    hideFeedback() {
        const feedback = this.container.querySelector('#manualInputFeedback');
        if (feedback) {
            feedback.classList.add('d-none');
        }
    }
    
    async handlePresetGeneration() {
        if (!this.currentPresetType || !this.areAllParametersValid()) {
            this.showError('Please select a graph type and provide valid parameters');
            return;
        }
        
        try {
            await this.generatePresetGraph(this.currentPresetType, this.presetParameters);
        } catch (error) {
            this.showError('Failed to generate preset graph: ' + error.message);
        }
    }
    
    async generatePresetGraph(type, params) {
        this.showLoading('Generating preset graph...');
        
        try {
            // Convert string parameters to appropriate types
            const processedParams = this.processParameters(params);
            
            const response = await fetch(`${this.options.serverUrl}/api/generate_preset_graph`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    graph_type: type,
                    parameters: processedParams
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.currentGraph = data.graph_data;
                this.setState({ 
                    graphLoaded: true, 
                    graphInfo: data.graph_info,
                    error: null
                });
                
                // Show success feedback
                this.showPresetGenerationSuccess(type, processedParams, data.graph_info);
                
                // Emit event for other components
                this.emit('graph:loaded', {
                    graphData: data.graph_data,
                    graphInfo: data.graph_info
                });
                
                this.emit('preset:generated', {
                    type: type,
                    parameters: processedParams,
                    graphInfo: data.graph_info
                });
                
            } else {
                this.showError('Preset generation failed: ' + data.error);
            }
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                this.showError('Cannot connect to server. Please check if the server is running.');
            } else {
                this.showError('Failed to generate preset graph: ' + error.message);
            }
        } finally {
            this.hideLoading();
        }
    }
    
    processParameters(params) {
        const processed = {};
        for (const [key, value] of Object.entries(params)) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                // Convert to integer for parameters that should be integers
                if (key === 'n' || key === 'm') {
                    processed[key] = parseInt(value);
                } else {
                    processed[key] = numValue;
                }
            } else {
                processed[key] = value;
            }
        }
        return processed;
    }
    
    showPresetGenerationSuccess(type, params, graphInfo) {
        const presetConfig = this.options.presetTypes[type];
        const typeName = presetConfig ? presetConfig.name : type;
        
        // Create a temporary success message
        const parametersContainer = this.container.querySelector('#presetParameters');
        if (parametersContainer) {
            const successMessage = document.createElement('div');
            successMessage.className = 'alert alert-success mt-2';
            successMessage.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <strong>Success!</strong> Generated ${typeName} graph with ${graphInfo.num_nodes} nodes and ${graphInfo.num_edges} edges.
            `;
            
            parametersContainer.appendChild(successMessage);
            
            // Remove the message after 3 seconds
            setTimeout(() => {
                if (successMessage.parentNode) {
                    successMessage.parentNode.removeChild(successMessage);
                }
            }, 3000);
        }
    }
}
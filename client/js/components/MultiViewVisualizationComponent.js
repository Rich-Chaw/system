/**
 * Multi-View Visualization Component
 * Manages multiple visualization views for different models
 */
class MultiViewVisualizationComponent extends BaseComponent {
    getDefaultOptions() {
        return {
            maxViews: 6,
            viewHeight: 350,
            showLabels: true,
            maxNodesForLabels: 50,
            nodeRadius: 4,
            linkDistance: 40,
            chargeStrength: -80,
            gridColumns: 'auto', // 'auto' or specific number
            responsive: true
        };
    }
    
    init() {
        this.views = new Map(); // modelId -> view instance
        this.currentGraphData = null;
        this.sharedState = {
            currentStep: 0,
            maxSteps: 0,
            stepData: new Map() // step -> { modelId -> state }
        };
        
        super.init();
        
        // Listen for model configuration changes
        this.on('models:changed', (data) => {
            console.log('MultiViewVisualizationComponent received models:changed event:', data);
            this.updateViews(data.models);
        });
        
        // Listen for graph data changes
        this.on('graph:loaded', (data) => {
            console.log('MultiViewVisualizationComponent received graph:loaded event:', data);
            this.setGraphData(data.graphData);
        });
        
        // Listen for dismantling results
        this.on('dismantling:completed', (data) => {
            console.log('MultiViewVisualizationComponent received dismantling:completed event:', data);
            this.handleDismantlingResults(data.results);
        });
        
        // Listen for progress control changes
        this.on('progress:step-changed', (data) => {
            this.updateToStep(data.step);
        });
        
        // Listen for graph clearing
        this.on('graph:cleared', () => {
            this.clearAllViews();
        });
    }
    
    setupEventListeners() {
        super.setupEventListeners();
        
        // Handle window resize for responsive layout
        if (this.options.responsive) {
            window.addEventListener('resize', () => {
                this.debounce(() => this.updateLayout(), 250);
            });
        }
    }
    
    render() {
        this.createViewContainer();
    }
    
    createViewContainer() {
        const container = this.container;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Create main visualization container
        const vizContainer = document.createElement('div');
        vizContainer.className = 'multi-view-container';
        vizContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h5><i class="fas fa-project-diagram"></i> Multi-Model Graph Visualization</h5>
                    <div class="view-controls">
                        <button class="btn btn-sm btn-outline-secondary" id="resetZoomBtn" title="Reset all views zoom">
                            <i class="fas fa-search-minus"></i> Reset Zoom
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" id="syncViewsBtn" title="Synchronize view positions">
                            <i class="fas fa-sync"></i> Sync Views
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="viewsGrid" class="views-grid">
                        <div class="no-models-message text-center text-muted py-5">
                            <i class="fas fa-eye-slash fa-3x mb-3"></i>
                            <h6>No Models Configured</h6>
                            <p>Configure models in the Model Selection panel to see visualizations</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(vizContainer);
        
        // Setup control event listeners
        this.setupControlListeners();
    }
    
    setupControlListeners() {
        const resetZoomBtn = this.container.querySelector('#resetZoomBtn');
        const syncViewsBtn = this.container.querySelector('#syncViewsBtn');
        
        if (resetZoomBtn) {
            resetZoomBtn.addEventListener('click', () => {
                this.resetAllZoom();
            });
        }
        
        if (syncViewsBtn) {
            syncViewsBtn.addEventListener('click', () => {
                this.synchronizeViews();
            });
        }
    }
    
    /**
     * Update views based on model configuration changes
     */
    updateViews(models) {
        const viewsGrid = this.container.querySelector('#viewsGrid');
        if (!viewsGrid) return;
        
        // Remove views for models that no longer exist
        const currentModelIds = new Set(models.map(m => m.id));
        for (const [modelId, view] of this.views) {
            if (!currentModelIds.has(modelId)) {
                this.removeView(modelId);
            }
        }
        
        // Create or update views for current models
        if (models.length === 0) {
            this.showNoModelsMessage();
        } else {
            this.hideNoModelsMessage();
            models.forEach(model => {
                if (!this.views.has(model.id)) {
                    this.createView(model);
                } else {
                    this.updateViewLabel(model);
                }
            });
        }
        
        // Update grid layout
        this.updateLayout();
        
        this.emit('views:updated', { 
            viewCount: this.views.size,
            models: models.map(m => ({ id: m.id, name: m.name }))
        });
    }
    
    /**
     * Create a new visualization view for a model
     */
    createView(model) {
        const viewsGrid = this.container.querySelector('#viewsGrid');
        if (!viewsGrid) return;
        
        // Create view container
        const viewContainer = document.createElement('div');
        viewContainer.className = 'visualization-view';
        viewContainer.setAttribute('data-model-id', model.id);
        
        const viewId = `view-${model.id}`;
        viewContainer.innerHTML = `
            <div class="view-header">
                <div class="view-title">
                    <h6 class="mb-0">
                        <span class="model-name">${this.escapeHtml(model.name)}</span>
                        <span class="status-indicator" data-status="ready">
                            <i class="fas fa-circle"></i>
                        </span>
                    </h6>
                </div>
                <div class="view-stats">
                    <small class="text-muted">
                        <span class="node-count">0</span> nodes, 
                        <span class="edge-count">0</span> edges
                    </small>
                </div>
            </div>
            <div class="view-content">
                <div id="${viewId}" class="graph-visualization" style="height: ${this.options.viewHeight}px;">
                    <div class="view-placeholder text-center text-muted">
                        <i class="fas fa-graph fa-2x mb-2"></i>
                        <p>Waiting for graph data...</p>
                    </div>
                </div>
            </div>
        `;
        
        viewsGrid.appendChild(viewContainer);
        
        // Create visualization instance for this view
        const viewInstance = new SingleVisualizationView(viewId, {
            ...this.options,
            modelId: model.id,
            modelName: model.name
        });
        
        // Store view reference
        this.views.set(model.id, {
            container: viewContainer,
            visualization: viewInstance,
            model: model
        });
        
        // If we have graph data, initialize the view
        if (this.currentGraphData) {
            viewInstance.setGraphData(this.currentGraphData);
        }
        
        this.emit('view:created', { modelId: model.id, viewId });
    }
    
    /**
     * Remove a visualization view
     */
    removeView(modelId) {
        const view = this.views.get(modelId);
        if (!view) return;
        
        // Destroy visualization instance
        view.visualization.destroy();
        
        // Remove DOM element
        view.container.remove();
        
        // Remove from views map
        this.views.delete(modelId);
        
        this.emit('view:removed', { modelId });
    }
    
    /**
     * Update view label when model name changes
     */
    updateViewLabel(model) {
        const view = this.views.get(model.id);
        if (!view) return;
        
        const nameElement = view.container.querySelector('.model-name');
        if (nameElement) {
            nameElement.textContent = model.name;
        }
        
        // Update view instance model info
        view.visualization.updateModelInfo(model);
        view.model = model;
    }
    
    /**
     * Update responsive grid layout
     */
    updateLayout() {
        const viewsGrid = this.container.querySelector('#viewsGrid');
        if (!viewsGrid) return;
        
        const viewCount = this.views.size;
        if (viewCount === 0) return;
        
        // Calculate optimal grid layout
        const columns = this.calculateOptimalColumns(viewCount);
        
        // Apply CSS grid layout
        viewsGrid.style.display = 'grid';
        viewsGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        viewsGrid.style.gap = '1rem';
        
        // Update view containers
        const viewElements = viewsGrid.querySelectorAll('.visualization-view');
        viewElements.forEach(element => {
            element.style.minHeight = `${this.options.viewHeight + 60}px`; // +60 for header
        });
        
        this.emit('layout:updated', { columns, viewCount });
    }
    
    /**
     * Calculate optimal number of columns based on view count and screen size
     */
    calculateOptimalColumns(viewCount) {
        if (this.options.gridColumns !== 'auto') {
            return Math.min(this.options.gridColumns, viewCount);
        }
        
        const containerWidth = this.container.clientWidth;
        const minViewWidth = 300; // Minimum width for a view
        
        // Calculate based on screen size
        let maxColumns;
        if (containerWidth < 768) {
            maxColumns = 1; // Mobile: single column
        } else if (containerWidth < 1200) {
            maxColumns = 2; // Tablet: two columns
        } else {
            maxColumns = Math.floor(containerWidth / minViewWidth);
        }
        
        // Optimal layout based on view count
        if (viewCount <= 2) return Math.min(viewCount, maxColumns);
        if (viewCount <= 4) return Math.min(2, maxColumns);
        if (viewCount <= 6) return Math.min(3, maxColumns);
        return Math.min(4, maxColumns);
    }
    
    /**
     * Set graph data for all views
     */
    setGraphData(graphData) {
        this.currentGraphData = graphData;
        
        // Update all existing views
        for (const [modelId, view] of this.views) {
            view.visualization.setGraphData(graphData);
            this.updateViewStats(modelId, graphData);
        }
        
        this.emit('graph:set', { 
            nodeCount: graphData.nodes?.length || 0,
            edgeCount: graphData.edges?.length || 0
        });
    }
    
    /**
     * Update view statistics display
     */
    updateViewStats(modelId, graphData) {
        const view = this.views.get(modelId);
        if (!view) return;
        
        const nodeCountEl = view.container.querySelector('.node-count');
        const edgeCountEl = view.container.querySelector('.edge-count');
        
        if (nodeCountEl) {
            nodeCountEl.textContent = graphData.nodes?.length || 0;
        }
        if (edgeCountEl) {
            edgeCountEl.textContent = graphData.edges?.length || 0;
        }
    }
    
    /**
     * Handle dismantling results from multiple models
     */
    handleDismantlingResults(results) {
        // Results should be an object with modelId as keys
        if (!results || typeof results !== 'object') return;
        
        // Store step data for progress control and synchronization
        this.sharedState.stepData.clear();
        this.sharedState.maxSteps = 0;
        
        // Process results for each model
        Object.entries(results).forEach(([modelId, modelResults]) => {
            const view = this.views.get(modelId);
            if (!view) return;
            
            // Update view status
            this.updateViewStatus(modelId, 'completed');
            
            // Store step-by-step data for synchronization
            if (modelResults.stepByStep) {
                modelResults.stepByStep.forEach((stepData, stepIndex) => {
                    if (!this.sharedState.stepData.has(stepIndex)) {
                        this.sharedState.stepData.set(stepIndex, new Map());
                    }
                    
                    // Normalize step data for synchronization
                    const normalizedStepData = this.normalizeStepData(stepData, modelResults);
                    this.sharedState.stepData.get(stepIndex).set(modelId, normalizedStepData);
                });
                
                this.sharedState.maxSteps = Math.max(
                    this.sharedState.maxSteps, 
                    modelResults.stepByStep.length
                );
            }
            
            // Initialize view with final state
            view.visualization.setDismantlingResults(modelResults);
        });
        
        // Initialize synchronized state
        this.initializeSynchronizedState();
        
        // Enable progress control
        this.emit('progress:enabled', { 
            maxSteps: this.sharedState.maxSteps,
            models: Object.keys(results)
        });
    }
    
    /**
     * Normalize step data for consistent synchronization across models
     */
    normalizeStepData(stepData, modelResults) {
        return {
            step: stepData.step || 0,
            nodeRemoved: stepData.nodeRemoved || stepData.node_removed,
            removedNodes: stepData.removedNodes || this.extractRemovedNodes(stepData, modelResults),
            remainingNodes: stepData.remainingNodes || stepData.remaining_nodes,
            largestCCSize: stepData.largestCCSize || stepData.largest_cc_size,
            networkState: stepData.networkState || this.extractNetworkState(stepData),
            timestamp: Date.now()
        };
    }
    
    /**
     * Extract removed nodes from step data
     */
    extractRemovedNodes(stepData, modelResults) {
        if (stepData.removedNodes) return stepData.removedNodes;
        
        // If we have the full solution, calculate removed nodes up to this step
        if (modelResults.solution && stepData.step !== undefined) {
            return modelResults.solution.slice(0, stepData.step + 1);
        }
        
        return [];
    }
    
    /**
     * Extract network state from step data
     */
    extractNetworkState(stepData) {
        if (stepData.networkState) return stepData.networkState;
        
        // Create basic network state from available data
        return {
            activeNodes: stepData.remainingNodes || [],
            removedNodes: stepData.removedNodes || [],
            largestCCSize: stepData.largestCCSize || stepData.largest_cc_size || 0
        };
    }
    
    /**
     * Initialize synchronized state management
     */
    initializeSynchronizedState() {
        // Set up state synchronization between views
        this.sharedState.syncEnabled = true;
        this.sharedState.lastSyncTime = Date.now();
        
        // Initialize all views to step 0 (original state)
        this.updateToStep(0);
        
        this.emit('sync:initialized', {
            maxSteps: this.sharedState.maxSteps,
            viewCount: this.views.size
        });
    }
    
    /**
     * Update all views to show a specific dismantling step (synchronized)
     */
    updateToStep(step) {
        if (!this.sharedState.syncEnabled) return;
        
        this.sharedState.currentStep = step;
        this.sharedState.lastSyncTime = Date.now();
        
        const stepData = this.sharedState.stepData.get(step);
        
        // Batch update all views simultaneously for smooth synchronization
        const updatePromises = [];
        
        for (const [modelId, view] of this.views) {
            const modelStepData = stepData?.get(modelId);
            
            if (modelStepData) {
                // Update view with synchronized timing
                const updatePromise = this.updateViewToStepSync(view, step, modelStepData);
                updatePromises.push(updatePromise);
            } else {
                // Handle missing step data gracefully
                this.handleMissingStepData(view, step, modelId);
            }
        }
        
        // Wait for all views to update before emitting completion
        Promise.all(updatePromises).then(() => {
            this.emit('views:step-updated', { 
                step, 
                viewCount: this.views.size,
                syncTime: Date.now() - this.sharedState.lastSyncTime
            });
        });
        
        // Update visual synchronization indicators
        this.updateSyncIndicators(step);
    }
    
    /**
     * Update a single view to a step with synchronization
     */
    async updateViewToStepSync(view, step, stepData) {
        return new Promise((resolve) => {
            // Add visual feedback for synchronization
            view.container.classList.add('syncing');
            
            // Perform the update
            view.visualization.updateToStep(step, stepData);
            
            // Remove sync indicator after a brief delay
            setTimeout(() => {
                view.container.classList.remove('syncing');
                resolve();
            }, 100);
        });
    }
    
    /**
     * Handle missing step data for a view
     */
    handleMissingStepData(view, step, modelId) {
        // Try to interpolate or use previous step data
        const previousStep = this.findPreviousValidStep(step, modelId);
        if (previousStep !== null) {
            const previousStepData = this.sharedState.stepData.get(previousStep)?.get(modelId);
            if (previousStepData) {
                view.visualization.updateToStep(step, previousStepData);
            }
        }
        
        // Mark view as having incomplete data
        view.container.classList.add('incomplete-data');
        this.updateViewStatus(modelId, 'warning');
    }
    
    /**
     * Find the most recent valid step data for a model
     */
    findPreviousValidStep(currentStep, modelId) {
        for (let step = currentStep - 1; step >= 0; step--) {
            const stepData = this.sharedState.stepData.get(step);
            if (stepData && stepData.has(modelId)) {
                return step;
            }
        }
        return null;
    }
    
    /**
     * Update visual synchronization indicators
     */
    updateSyncIndicators(step) {
        // Add synchronized class to all views
        for (const [modelId, view] of this.views) {
            view.container.classList.add('synchronized');
            
            // Update step indicator if present
            const stepIndicator = view.container.querySelector('.step-indicator');
            if (stepIndicator) {
                stepIndicator.textContent = `Step ${step}`;
            }
        }
        
        // Remove synchronized class after animation
        setTimeout(() => {
            for (const [modelId, view] of this.views) {
                view.container.classList.remove('synchronized');
            }
        }, 500);
    }
    
    /**
     * Update view status indicator
     */
    updateViewStatus(modelId, status) {
        const view = this.views.get(modelId);
        if (!view) return;
        
        const statusIndicator = view.container.querySelector('.status-indicator');
        if (!statusIndicator) return;
        
        statusIndicator.setAttribute('data-status', status);
        
        const icon = statusIndicator.querySelector('i');
        if (icon) {
            icon.className = this.getStatusIcon(status);
        }
    }
    
    /**
     * Get appropriate icon for status
     */
    getStatusIcon(status) {
        const icons = {
            'ready': 'fas fa-circle text-secondary',
            'processing': 'fas fa-spinner fa-spin text-warning',
            'completed': 'fas fa-check-circle text-success',
            'error': 'fas fa-exclamation-circle text-danger'
        };
        return icons[status] || icons['ready'];
    }
    
    /**
     * Clear all visualization views
     */
    clearAllViews() {
        for (const [modelId, view] of this.views) {
            view.visualization.clear();
            this.updateViewStatus(modelId, 'ready');
        }
        
        this.currentGraphData = null;
        this.sharedState.stepData.clear();
        this.sharedState.currentStep = 0;
        this.sharedState.maxSteps = 0;
        
        this.emit('views:cleared');
    }
    
    /**
     * Reset zoom for all views
     */
    resetAllZoom() {
        for (const [modelId, view] of this.views) {
            view.visualization.resetZoom();
        }
    }
    
    /**
     * Synchronize view positions and zoom levels
     */
    synchronizeViews() {
        if (this.views.size < 2) return;
        
        // Get transform from first view
        const firstView = Array.from(this.views.values())[0];
        const transform = firstView.visualization.getCurrentTransform();
        
        if (transform) {
            // Apply to all other views
            for (const [modelId, view] of this.views) {
                view.visualization.setTransform(transform);
            }
        }
    }
    
    /**
     * Show/hide no models message
     */
    showNoModelsMessage() {
        const viewsGrid = this.container.querySelector('#viewsGrid');
        const message = viewsGrid?.querySelector('.no-models-message');
        if (message) {
            message.style.display = 'block';
        }
    }
    
    hideNoModelsMessage() {
        const viewsGrid = this.container.querySelector('#viewsGrid');
        const message = viewsGrid?.querySelector('.no-models-message');
        if (message) {
            message.style.display = 'none';
        }
    }
    
    /**
     * Utility methods
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    debounce(func, wait) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(func, wait);
    }
    
    /**
     * Enable or disable synchronization between views
     */
    setSynchronizationEnabled(enabled) {
        this.sharedState.syncEnabled = enabled;
        
        // Update visual indicators
        for (const [modelId, view] of this.views) {
            if (enabled) {
                view.container.classList.add('sync-enabled');
            } else {
                view.container.classList.remove('sync-enabled');
            }
        }
        
        this.emit('sync:toggled', { enabled, viewCount: this.views.size });
    }
    
    /**
     * Get synchronization status
     */
    getSynchronizationStatus() {
        return {
            enabled: this.sharedState.syncEnabled,
            currentStep: this.sharedState.currentStep,
            maxSteps: this.sharedState.maxSteps,
            lastSyncTime: this.sharedState.lastSyncTime,
            viewCount: this.views.size
        };
    }
    
    /**
     * Force synchronization of all views to current step
     */
    forceSynchronization() {
        if (this.sharedState.syncEnabled) {
            this.updateToStep(this.sharedState.currentStep);
        }
    }
    
    /**
     * Compare performance across models at current step
     */
    compareModelPerformance() {
        const currentStep = this.sharedState.currentStep;
        const stepData = this.sharedState.stepData.get(currentStep);
        
        if (!stepData) return null;
        
        const performance = {};
        for (const [modelId, modelStepData] of stepData) {
            performance[modelId] = {
                largestCCSize: modelStepData.largestCCSize || 0,
                nodesRemoved: modelStepData.removedNodes?.length || 0,
                efficiency: this.calculateEfficiency(modelStepData)
            };
        }
        
        // Highlight best and worst performers
        this.highlightPerformanceComparison(performance);
        
        return performance;
    }
    
    /**
     * Calculate efficiency metric for a model at a step
     */
    calculateEfficiency(stepData) {
        const nodesRemoved = stepData.removedNodes?.length || 0;
        const largestCCSize = stepData.largestCCSize || 0;
        const totalNodes = this.currentGraphData?.nodes?.length || 1;
        
        // Simple efficiency: reduction in largest CC per node removed
        if (nodesRemoved === 0) return 0;
        return (totalNodes - largestCCSize) / nodesRemoved;
    }
    
    /**
     * Highlight views based on performance comparison
     */
    highlightPerformanceComparison(performance) {
        const modelIds = Object.keys(performance);
        if (modelIds.length < 2) return;
        
        // Find best and worst performers
        let bestModel = modelIds[0];
        let worstModel = modelIds[0];
        
        for (const modelId of modelIds) {
            if (performance[modelId].efficiency > performance[bestModel].efficiency) {
                bestModel = modelId;
            }
            if (performance[modelId].efficiency < performance[worstModel].efficiency) {
                worstModel = modelId;
            }
        }
        
        // Apply visual highlights
        for (const [modelId, view] of this.views) {
            view.container.classList.remove('best-performance', 'worst-performance');
            
            if (modelId === bestModel && modelIds.length > 1) {
                view.container.classList.add('best-performance');
            } else if (modelId === worstModel && modelIds.length > 1) {
                view.container.classList.add('worst-performance');
            }
        }
        
        // Remove highlights after a delay
        setTimeout(() => {
            for (const [modelId, view] of this.views) {
                view.container.classList.remove('best-performance', 'worst-performance');
            }
        }, 3000);
    }
    
    /**
     * Get current state of all views
     */
    getViewsState() {
        const viewsState = {};
        for (const [modelId, view] of this.views) {
            viewsState[modelId] = view.visualization.getState();
        }
        return {
            viewCount: this.views.size,
            currentStep: this.sharedState.currentStep,
            maxSteps: this.sharedState.maxSteps,
            syncEnabled: this.sharedState.syncEnabled,
            views: viewsState
        };
    }
    
    /**
     * Handle view-specific events for synchronization
     */
    handleViewEvent(modelId, eventType, eventData) {
        const view = this.views.get(modelId);
        if (!view) return;
        
        switch (eventType) {
            case 'zoom':
                if (this.sharedState.syncEnabled) {
                    this.synchronizeZoom(eventData.transform);
                }
                break;
            case 'pan':
                if (this.sharedState.syncEnabled) {
                    this.synchronizePan(eventData.transform);
                }
                break;
            case 'node-hover':
                this.synchronizeNodeHighlight(eventData.nodeId, true);
                break;
            case 'node-unhover':
                this.synchronizeNodeHighlight(eventData.nodeId, false);
                break;
        }
    }
    
    /**
     * Synchronize zoom across all views
     */
    synchronizeZoom(transform) {
        for (const [modelId, view] of this.views) {
            view.visualization.setTransform(transform);
        }
    }
    
    /**
     * Synchronize pan across all views
     */
    synchronizePan(transform) {
        for (const [modelId, view] of this.views) {
            view.visualization.setTransform(transform);
        }
    }
    
    /**
     * Synchronize node highlighting across all views
     */
    synchronizeNodeHighlight(nodeId, highlight) {
        for (const [modelId, view] of this.views) {
            if (highlight) {
                view.visualization.highlightNode(nodeId);
            } else {
                view.visualization.unhighlightNode(nodeId);
            }
        }
    }
    
    /**
     * Destroy component and cleanup
     */
    destroy() {
        // Destroy all view instances
        for (const [modelId, view] of this.views) {
            view.visualization.destroy();
        }
        this.views.clear();
        
        // Clear timers
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        super.destroy();
    }
}
/**

 * Single Visualization View
 * Handles individual visualization instance for one model
 */
class SingleVisualizationView {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = {
            nodeRadius: 4,
            linkDistance: 40,
            chargeStrength: -80,
            showLabels: false,
            maxNodesForLabels: 30,
            ...options
        };
        
        this.simulation = null;
        this.svg = null;
        this.graphData = null;
        this.dismantlingResults = null;
        this.currentStep = 0;
        this.removedNodes = new Set();
        
        // D3 selections
        this.nodeSelection = null;
        this.linkSelection = null;
        this.labelSelection = null;
        
        this.init();
    }
    
    init() {
        if (!this.container) {
            console.error(`Container ${this.containerId} not found`);
            return;
        }
        
        this.initializeVisualization();
    }
    
    initializeVisualization() {
        // Clear existing content
        this.container.innerHTML = '';
        
        const width = this.container.clientWidth || 300;
        const height = this.options.viewHeight || 350;
        
        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('border', '1px solid #e9ecef')
            .style('border-radius', '0.375rem')
            .style('background-color', '#fff');
        
        // Add zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                this.svg.select('.graph-container')
                    .attr('transform', event.transform);
            });
        
        this.svg.call(this.zoom);
        
        // Create container for graph elements
        this.graphContainer = this.svg.append('g')
            .attr('class', 'graph-container');
        
        // Add empty state message
        this.showEmptyState();
    }
    
    showEmptyState() {
        const width = this.svg.attr('width');
        const height = this.svg.attr('height');
        
        this.emptyStateGroup = this.svg.append('g')
            .attr('class', 'empty-state')
            .attr('transform', `translate(${width/2}, ${height/2})`);
        
        this.emptyStateGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '-10')
            .attr('fill', '#6c757d')
            .attr('font-size', '14px')
            .text('No graph data');
        
        this.emptyStateGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '10')
            .attr('fill', '#adb5bd')
            .attr('font-size', '12px')
            .text('Load a graph to see visualization');
    }
    
    hideEmptyState() {
        if (this.emptyStateGroup) {
            this.emptyStateGroup.remove();
            this.emptyStateGroup = null;
        }
    }
    
    setGraphData(graphData) {
        this.graphData = graphData;
        this.removedNodes.clear();
        this.currentStep = 0;
        
        if (!graphData || !graphData.edges || graphData.edges.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideEmptyState();
        this.renderGraph();
    }
    
    renderGraph() {
        if (!this.graphData) return;
        
        // Clear previous visualization
        this.graphContainer.selectAll('*').remove();
        
        // Prepare data
        const nodes = [];
        const links = [];
        const nodeSet = new Set();
        
        // Extract nodes and edges
        this.graphData.edges.forEach(edge => {
            const source = edge.source || edge[0];
            const target = edge.target || edge[1];
            nodeSet.add(source);
            nodeSet.add(target);
            links.push({ 
                source: source, 
                target: target,
                id: `${source}-${target}`
            });
        });
        
        nodeSet.forEach(nodeId => {
            nodes.push({ 
                id: nodeId,
                removed: false
            });
        });
        
        const width = this.svg.attr('width');
        const height = this.svg.attr('height');
        
        // Create force simulation
        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(this.options.linkDistance))
            .force('charge', d3.forceManyBody().strength(this.options.chargeStrength))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(this.options.nodeRadius + 2));
        
        // Add links
        this.linkSelection = this.graphContainer.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);
        
        // Add nodes
        this.nodeSelection = this.graphContainer.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', this.options.nodeRadius)
            .attr('fill', '#69b3a2')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .call(this.createDragBehavior());
        
        // Add labels for small graphs
        if (this.options.showLabels && nodes.length <= this.options.maxNodesForLabels) {
            this.labelSelection = this.graphContainer.append('g')
                .attr('class', 'labels')
                .selectAll('text')
                .data(nodes)
                .enter().append('text')
                .text(d => d.id)
                .attr('font-size', '8px')
                .attr('text-anchor', 'middle')
                .attr('dy', '.35em')
                .attr('pointer-events', 'none')
                .attr('fill', '#495057');
        }
        
        // Update positions on simulation tick
        this.simulation.on('tick', () => {
            this.linkSelection
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            this.nodeSelection
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            if (this.labelSelection) {
                this.labelSelection
                    .attr('x', d => d.x)
                    .attr('y', d => d.y);
            }
        });
        
        // Store data references
        this.nodes = nodes;
        this.links = links;
    }
    
    createDragBehavior() {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }
    
    setDismantlingResults(results) {
        this.dismantlingResults = results;
        
        // Initialize to final state by default
        if (results.stepByStep && results.stepByStep.length > 0) {
            const finalStep = results.stepByStep.length - 1;
            this.updateToStep(finalStep, results.stepByStep[finalStep]);
        }
    }
    
    updateToStep(step, stepData) {
        if (!this.nodeSelection || !stepData) return;
        
        this.currentStep = step;
        
        // Store previous state for smooth transitions
        const previousRemovedNodes = new Set(this.removedNodes);
        
        // Update removed nodes based on step data
        this.removedNodes.clear();
        if (stepData.removedNodes) {
            stepData.removedNodes.forEach(nodeId => {
                this.removedNodes.add(nodeId);
            });
        } else if (stepData.networkState && stepData.networkState.activeNodes) {
            // If we have active nodes, removed nodes are the complement
            const activeNodes = new Set(stepData.networkState.activeNodes);
            this.nodes.forEach(node => {
                if (!activeNodes.has(node.id)) {
                    this.removedNodes.add(node.id);
                }
            });
        }
        
        // Identify nodes that changed state for enhanced visual feedback
        const newlyRemoved = new Set();
        const newlyRestored = new Set();
        
        for (const nodeId of this.removedNodes) {
            if (!previousRemovedNodes.has(nodeId)) {
                newlyRemoved.add(nodeId);
            }
        }
        
        for (const nodeId of previousRemovedNodes) {
            if (!this.removedNodes.has(nodeId)) {
                newlyRestored.add(nodeId);
            }
        }
        
        // Update visual appearance with transition effects
        this.updateNodeAppearanceWithTransitions(newlyRemoved, newlyRestored);
        this.updateLinkAppearanceWithTransitions();
        
        // Update step-specific visual indicators
        this.updateStepIndicators(step, stepData);
    }
    
    /**
     * Update node appearance with smooth transitions for state changes
     */
    updateNodeAppearanceWithTransitions(newlyRemoved, newlyRestored) {
        if (!this.nodeSelection) return;
        
        // Apply base styling
        this.nodeSelection
            .classed('removed', d => this.removedNodes.has(d.id))
            .classed('newly-removed', d => newlyRemoved.has(d.id))
            .classed('newly-restored', d => newlyRestored.has(d.id));
        
        // Animate color and opacity changes
        this.nodeSelection
            .transition()
            .duration(200)
            .attr('fill', d => {
                if (this.removedNodes.has(d.id)) {
                    return newlyRemoved.has(d.id) ? '#dc3545' : '#ff6b6b';
                }
                return newlyRestored.has(d.id) ? '#28a745' : '#69b3a2';
            })
            .attr('opacity', d => this.removedNodes.has(d.id) ? 0.5 : 1)
            .attr('stroke', d => {
                if (this.removedNodes.has(d.id)) return '#dc3545';
                if (newlyRestored.has(d.id)) return '#28a745';
                return '#fff';
            })
            .attr('stroke-width', d => {
                if (newlyRemoved.has(d.id) || newlyRestored.has(d.id)) return 2;
                return 1.5;
            });
        
        // Remove transition classes after animation
        setTimeout(() => {
            this.nodeSelection
                .classed('newly-removed', false)
                .classed('newly-restored', false);
        }, 300);
    }
    
    /**
     * Update link appearance with smooth transitions
     */
    updateLinkAppearanceWithTransitions() {
        if (!this.linkSelection) return;
        
        this.linkSelection
            .classed('removed', d => 
                this.removedNodes.has(d.source.id) || this.removedNodes.has(d.target.id))
            .transition()
            .duration(200)
            .attr('stroke', d => 
                this.removedNodes.has(d.source.id) || this.removedNodes.has(d.target.id) ? '#ccc' : '#999')
            .attr('stroke-opacity', d => 
                this.removedNodes.has(d.source.id) || this.removedNodes.has(d.target.id) ? 0.2 : 0.6);
    }
    
    /**
     * Update step-specific visual indicators
     */
    updateStepIndicators(step, stepData) {
        // Update any step-specific overlays or indicators
        if (stepData.largestCCSize !== undefined) {
            this.updateConnectedComponentHighlight(stepData);
        }
        
        // Update node labels if enabled
        if (this.labelSelection && stepData.nodeRemoved) {
            this.highlightRecentlyRemovedNode(stepData.nodeRemoved);
        }
    }
    
    /**
     * Highlight the largest connected component
     */
    updateConnectedComponentHighlight(stepData) {
        // This would require connected component calculation
        // For now, we'll just store the information
        this.currentLargestCCSize = stepData.largestCCSize;
    }
    
    /**
     * Highlight the most recently removed node
     */
    highlightRecentlyRemovedNode(nodeId) {
        if (!this.nodeSelection) return;
        
        // Temporarily highlight the recently removed node
        this.nodeSelection
            .filter(d => d.id === nodeId)
            .classed('recently-removed', true)
            .transition()
            .duration(1000)
            .attr('stroke-width', 3)
            .transition()
            .duration(500)
            .attr('stroke-width', 1.5)
            .on('end', function() {
                d3.select(this).classed('recently-removed', false);
            });
    }
    
    updateNodeAppearance() {
        if (!this.nodeSelection) return;
        
        this.nodeSelection
            .classed('removed', d => this.removedNodes.has(d.id))
            .attr('fill', d => this.removedNodes.has(d.id) ? '#ff6b6b' : '#69b3a2')
            .attr('opacity', d => this.removedNodes.has(d.id) ? 0.5 : 1)
            .attr('stroke', d => this.removedNodes.has(d.id) ? '#dc3545' : '#fff');
    }
    
    updateLinkAppearance() {
        if (!this.linkSelection) return;
        
        this.linkSelection
            .classed('removed', d => 
                this.removedNodes.has(d.source.id) || this.removedNodes.has(d.target.id))
            .attr('stroke', d => 
                this.removedNodes.has(d.source.id) || this.removedNodes.has(d.target.id) ? '#ccc' : '#999')
            .attr('stroke-opacity', d => 
                this.removedNodes.has(d.source.id) || this.removedNodes.has(d.target.id) ? 0.2 : 0.6);
    }
    
    updateModelInfo(model) {
        this.options.modelId = model.id;
        this.options.modelName = model.name;
    }
    
    clear() {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
        
        if (this.graphContainer) {
            this.graphContainer.selectAll('*').remove();
        }
        
        this.graphData = null;
        this.dismantlingResults = null;
        this.removedNodes.clear();
        this.currentStep = 0;
        
        this.showEmptyState();
    }
    
    resetZoom() {
        if (this.svg && this.zoom) {
            this.svg.transition()
                .duration(750)
                .call(this.zoom.transform, d3.zoomIdentity);
        }
    }
    
    getCurrentTransform() {
        if (this.svg) {
            return d3.zoomTransform(this.svg.node());
        }
        return null;
    }
    
    setTransform(transform) {
        if (this.svg && this.zoom) {
            this.svg.call(this.zoom.transform, transform);
        }
    }
    
    /**
     * Highlight a specific node
     */
    highlightNode(nodeId) {
        if (!this.nodeSelection) return;
        
        this.nodeSelection
            .filter(d => d.id === nodeId)
            .classed('highlighted', true)
            .attr('stroke', '#ffc107')
            .attr('stroke-width', 3);
    }
    
    /**
     * Remove highlight from a specific node
     */
    unhighlightNode(nodeId) {
        if (!this.nodeSelection) return;
        
        this.nodeSelection
            .filter(d => d.id === nodeId)
            .classed('highlighted', false)
            .attr('stroke', d => this.removedNodes.has(d.id) ? '#dc3545' : '#fff')
            .attr('stroke-width', d => this.removedNodes.has(d.id) ? 2 : 1.5);
    }
    
    /**
     * Remove all node highlights
     */
    clearHighlights() {
        if (!this.nodeSelection) return;
        
        this.nodeSelection
            .classed('highlighted', false)
            .attr('stroke', d => this.removedNodes.has(d.id) ? '#dc3545' : '#fff')
            .attr('stroke-width', d => this.removedNodes.has(d.id) ? 2 : 1.5);
    }
    
    getState() {
        return {
            hasGraph: !!this.graphData,
            nodeCount: this.nodes ? this.nodes.length : 0,
            linkCount: this.links ? this.links.length : 0,
            removedCount: this.removedNodes.size,
            currentStep: this.currentStep,
            currentLargestCCSize: this.currentLargestCCSize || 0
        };
    }
    
    destroy() {
        if (this.simulation) {
            this.simulation.stop();
        }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        this.simulation = null;
        this.svg = null;
        this.graphData = null;
        this.dismantlingResults = null;
        this.nodeSelection = null;
        this.linkSelection = null;
        this.labelSelection = null;
    }
}
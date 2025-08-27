// FINDER_ND Client Application - Refactored with Component Architecture
class FinderNDClient {
    constructor() {
        this.serverUrl = 'http://localhost:5000';
        this.components = {};
        this.currentResults = null;

        this.init();
    }

    init() {
        this.initializeComponents();
        this.setupGlobalEventListeners();
        this.checkServerStatus();
    }

    initializeComponents() {
        // Get component manager instance first
        this.componentManager = ComponentManager.getInstance();

        // Initialize Visualization Component first (so it's ready to receive events)
        console.log('Initializing SimpleVisualizationComponent...');
        this.components.visualization = new SimpleVisualizationComponent('graph-visualization');
        console.log('SimpleVisualizationComponent initialized:', this.components.visualization);

        // Initialize Graph Statistics Component
        console.log('Initializing GraphStatisticsComponent...');
        this.components.graphStatistics = new GraphStatisticsComponent('graph-statistics-container', {
            showAdvancedStats: true,
            showDegreeDistribution: true,
            expandable: true
        });
        console.log('GraphStatisticsComponent initialized:', this.components.graphStatistics);

        // Initialize Multi-View Visualization Component
        this.components.multiViewVisualization = new MultiViewVisualizationComponent('multi-view-visualization', {
            maxViews: 6,
            viewHeight: 350,
            showLabels: true,
            maxNodesForLabels: 50,
            responsive: true
        });

        // Initialize Model Selection Component
        this.components.modelSelection = new ModelSelectionComponent('model-selection', {
            serverUrl: this.serverUrl
        });

        // Initialize Graph Upload Component last (so other components are ready when it emits events)
        this.components.graphUpload = new GraphUploadComponent('graph-input', {
            serverUrl: this.serverUrl
        });

        // Register components with the manager
        this.componentManager.registerComponent('graph-input', this.components.graphUpload);
        this.componentManager.registerComponent('graph-statistics', this.components.graphStatistics);
        this.componentManager.registerComponent('graph-visualization', this.components.visualization);
        this.componentManager.registerComponent('multi-view-visualization', this.components.multiViewVisualization);
        this.componentManager.registerComponent('model-selection', this.components.modelSelection);

        console.log('All components registered. Event bus status:', this.componentManager.eventBus.getEvents());

        // Make components available globally for debugging
        window.debugComponents = this.components;
        window.testVisualization = () => {
            console.log('Testing SimpleVisualizationComponent...');
            if (this.components.visualization) {
                this.components.visualization.testVisualization();
            } else {
                console.error('SimpleVisualizationComponent not found!');
            }
        };
    }

    setupGlobalEventListeners() {
        const eventBus = this.componentManager.eventBus;

        // Debug: Listen for graph:loaded events to see if they're being emitted
        eventBus.on('graph:loaded', (data) => {
            console.log('App received graph:loaded event:', data);
        });

        // Graph info display is now handled by GraphStatisticsComponent

        // Listen for dismantling completion to show results
        eventBus.on('dismantling:completed', (data) => {
            this.currentResults = data.results;
            this.displayResults(data.results);
        });

        // Listen for dismantling progress updates
        eventBus.on('dismantling:progress', (data) => {
            this.updateProgress(data);
        });

        // Listen for component errors
        eventBus.on('component:error', (data) => {
            console.error(`Component error in ${data.componentId}:`, data.error);
        });

        // Listen for global clear events
        eventBus.on('app:clear-all', () => {
            // Components will handle their own clearing
        });

        // Setup export button listeners (these remain global for now)
        this.setupExportListeners();
    }

    setupExportListeners() {
        // Export buttons
        const exportSolutionBtn = document.getElementById('exportSolution');
        const exportResultsBtn = document.getElementById('exportResults');

        if (exportSolutionBtn) {
            exportSolutionBtn.addEventListener('click', () => {
                this.exportSolution();
            });
        }

        if (exportResultsBtn) {
            exportResultsBtn.addEventListener('click', () => {
                this.exportResults();
            });
        }
    }

    async checkServerStatus() {
        try {
            const response = await fetch(`${this.serverUrl}/api/health`);
            const data = await response.json();

            this.updateServerStatus(true, data);
        } catch (error) {
            this.updateServerStatus(false, null);
        }
    }

    updateServerStatus(connected, data) {
        const statusElement = document.getElementById('server-status');

        if (connected) {
            statusElement.innerHTML = '<i class="fas fa-circle status-connected"></i> Connected';
            statusElement.title = `Server healthy. Models: ${data.available_models ? data.available_models.length : 'Unknown'}`;
        } else {
            statusElement.innerHTML = '<i class="fas fa-circle status-disconnected"></i> Disconnected';
            statusElement.title = 'Cannot connect to server';
        }
    }

    // Graph info display is now handled by GraphStatisticsComponent

    // Dismantling is now handled by ModelSelectionComponent
    // This method is kept for handling the results display

    displayResults(results) {
        // Update summary stats
        document.getElementById('nodesRemoved').textContent = results.solution.length;
        document.getElementById('executionTime').textContent = results.execution_time.toFixed(2);
        document.getElementById('robustness').textContent = results.metrics.robustness.toFixed(3);
        document.getElementById('finalCC').textContent = results.metrics.final_largest_cc;

        // Show results card
        document.getElementById('resultsCard').style.display = 'block';

        // Create charts
        this.createDismantlingChart(results.metrics.largest_cc_evolution);
        this.createMetricsChart(results.metrics);

        // Display solution details
        this.displaySolutionDetails(results.solution, results.metrics.removal_sequence);
    }

    createDismantlingChart(ccEvolution) {
        const ctx = document.getElementById('dismantlingChart').getContext('2d');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ccEvolution.map((_, i) => i + 1),
                datasets: [{
                    label: 'Largest Connected Component Size',
                    data: ccEvolution,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Network Dismantling Progress'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Removal Step'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Largest CC Size'
                        }
                    }
                }
            }
        });
    }

    createMetricsChart(metrics) {
        const ctx = document.getElementById('metricsChart').getContext('2d');

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Nodes Removed', 'Nodes Remaining'],
                datasets: [{
                    data: [metrics.nodes_removed, metrics.removal_sequence[0]?.remaining_nodes || 0],
                    backgroundColor: ['#ff6b6b', '#69b3a2'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Node Removal Distribution'
                    }
                }
            }
        });
    }

    displaySolutionDetails(solution, removalSequence) {
        const detailsDiv = document.getElementById('solutionDetails');

        let html = '<div class="row"><div class="col-2"><strong>Step</strong></div><div class="col-2"><strong>Node</strong></div><div class="col-4"><strong>Remaining Nodes</strong></div><div class="col-4"><strong>Largest CC</strong></div></div>';

        removalSequence.slice(0, 50).forEach(step => { // Show first 50 steps
            html += `
                <div class="removal-step row">
                    <div class="col-2">${step.step}</div>
                    <div class="col-2">${step.node_removed}</div>
                    <div class="col-4">${step.remaining_nodes}</div>
                    <div class="col-4">${step.largest_cc_size}</div>
                </div>
            `;
        });

        if (removalSequence.length > 50) {
            html += `<div class="text-muted text-center mt-2">... and ${removalSequence.length - 50} more steps</div>`;
        }

        detailsDiv.innerHTML = html;
    }

    // Graph visualization is now handled by SimpleVisualizationComponent

    showProgress(message) {
        const progressCard = document.getElementById('progressCard');
        const progressText = document.getElementById('progressText');
        const progressBar = document.getElementById('progressBar');

        if (progressCard) progressCard.style.display = 'block';
        if (progressText) progressText.textContent = message;
        if (progressBar) progressBar.style.width = '100%';
    }

    hideProgress() {
        const progressCard = document.getElementById('progressCard');
        if (progressCard) progressCard.style.display = 'none';
    }

    updateProgress(data) {
        // Handle progress updates from dismantling process
        if (data.message) {
            this.showProgress(data.message);
        }

        if (data.progress !== undefined) {
            const progressBar = document.getElementById('progressBar');
            if (progressBar) {
                progressBar.style.width = `${data.progress}%`;
            }
        }
    }

    showError(message) {
        alert('Error: ' + message); // Simple error display for now
    }

    // Clear methods are now handled by individual components
    clearAll() {
        // Emit global clear event
        this.componentManager.eventBus.emit('app:clear-all');

        // Clear results display
        const resultsCard = document.getElementById('resultsCard');
        if (resultsCard) resultsCard.style.display = 'none';

        this.currentResults = null;
    }

    exportSolution() {
        if (!this.currentResults) return;

        const solution = this.currentResults.solution;
        const blob = new Blob([solution.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'dismantling_solution.txt';
        a.click();

        URL.revokeObjectURL(url);
    }

    exportResults() {
        if (!this.currentResults) return;

        const results = JSON.stringify(this.currentResults, null, 2);
        const blob = new Blob([results], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'dismantling_results.json';
        a.click();

        URL.revokeObjectURL(url);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the main application
    new FinderNDClient();
});
// NetworkDismantling Client Application - Refactored with Component Architecture
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

        // Initialize Progress Control Component
        this.components.progressControl = new ProgressControlComponent('progress-control', {
            autoPlaySpeed: 500,
            showStepInfo: true
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
        this.componentManager.registerComponent('progress-control', this.components.progressControl);
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
        console.log('displayResults called with:', results);
        if (!results || !Array.isArray(results) || results.length === 0) return;

        const successfulResults = results.filter(r => r.result && !r.error);
        if (successfulResults.length === 0) {
            console.warn('No successful results to display');
            return;
        }

        // Show chart card and results card
        const chartCard = document.getElementById('dismantlingChartCard');
        const resultsCard = document.getElementById('resultsCard');
        if (chartCard) chartCard.style.display = 'block';
        if (resultsCard) resultsCard.style.display = 'block';

        // Draw LCC progress chart (all models)
        this.createDismantlingChart(successfulResults);

        // Build per-model stats table
        this.buildModelStatsTable(successfulResults);

        // Build tabbed removal sequences
        this.buildRemovalTabs(successfulResults);
    }

    buildModelStatsTable(results) {
        const container = document.getElementById('modelStatsTable');
        if (!container) return;

        const colors = ['text-primary', 'text-success', 'text-info', 'text-warning', 'text-danger', 'text-secondary'];
        const typeColors = { finder: 'primary', mind: 'info', baseline: 'secondary' };

        let html = `<div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th>Model</th>
                        <th class="text-center">Nodes Removed</th>
                        <th class="text-center">Exec Time (s)</th>
                        <th class="text-center">Robustness</th>
                        <th class="text-center">Final LCC</th>
                    </tr>
                </thead>
                <tbody>`;

        results.forEach((item, i) => {
            const { removals, score, lcc_sizes, execution_time } = item.result;
            const type = item.modelConfig.type || '';
            const badgeColor = typeColors[type] || 'secondary';
            const finalLCC = lcc_sizes && lcc_sizes.length ? lcc_sizes[lcc_sizes.length - 1].toFixed(4) : '-';
            html += `<tr>
                <td>
                    <span class="badge bg-${badgeColor} me-1">${type.toUpperCase()}</span>
                    <small class="${colors[i % colors.length]}">${this.escapeHtml(item.modelConfig.name)}</small>
                </td>
                <td class="text-center fw-bold">${removals ? removals.length : '-'}</td>
                <td class="text-center">${execution_time != null ? execution_time.toFixed(2) : '-'}</td>
                <td class="text-center">${score != null ? score.toFixed(4) : '-'}</td>
                <td class="text-center">${finalLCC}</td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    buildRemovalTabs(results) {
        const tabsEl = document.getElementById('removalTabs');
        const contentEl = document.getElementById('removalTabContent');
        if (!tabsEl || !contentEl) return;

        tabsEl.innerHTML = '';
        contentEl.innerHTML = '';

        results.forEach((item, i) => {
            const tabId = `removal-tab-${i}`;
            const paneId = `removal-pane-${i}`;
            const isActive = i === 0;

            tabsEl.innerHTML += `
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${isActive ? 'active' : ''}" id="${tabId}"
                        data-bs-toggle="tab" data-bs-target="#${paneId}"
                        type="button" role="tab">
                        ${this.escapeHtml(item.modelConfig.name)}
                    </button>
                </li>`;

            const { removals, lcc_sizes } = item.result;
            let tableHtml = `<div class="bg-light p-2" style="max-height:220px;overflow-y:auto;font-family:monospace;font-size:0.85rem;">
                <div class="row fw-bold border-bottom mb-1 px-1">
                    <div class="col-2">Step</div>
                    <div class="col-5">Node Removed</div>
                    <div class="col-5">LCC (fraction)</div>
                </div>`;

            const limit = Math.min((removals || []).length, 100);
            for (let j = 0; j < limit; j++) {
                const lcc = lcc_sizes && lcc_sizes[j + 1] != null ? lcc_sizes[j + 1].toFixed(4) : '-';
                tableHtml += `<div class="row removal-step px-1">
                    <div class="col-2">${j + 1}</div>
                    <div class="col-5">${removals[j]}</div>
                    <div class="col-5">${lcc}</div>
                </div>`;
            }
            if ((removals || []).length > 100) {
                tableHtml += `<div class="text-muted text-center mt-1">... and ${removals.length - 100} more</div>`;
            }
            tableHtml += `</div>`;

            contentEl.innerHTML += `
                <div class="tab-pane fade ${isActive ? 'show active' : ''}" id="${paneId}" role="tabpanel">
                    ${tableHtml}
                </div>`;
        });
    }

    escapeHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    createDismantlingChart(results) {
        const canvas = document.getElementById('dismantlingChart');
        if (!canvas) return;

        if (this._dismantlingChart) {
            this._dismantlingChart.destroy();
        }

        const colors = ['#667eea', '#ff6b6b', '#69b3a2', '#ffa500', '#9b59b6', '#1abc9c'];

        const datasets = results
            .filter(r => r.result && r.result.lcc_sizes && r.result.lcc_sizes.length > 0)
            .map((item, i) => ({
                label: item.modelConfig.name,
                data: item.result.lcc_sizes,
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '22',
                fill: false,
                tension: 0.3,
                pointRadius: 2
            }));

        if (datasets.length === 0) return;

        const maxLen = Math.max(...datasets.map(d => d.data.length));

        this._dismantlingChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: Array.from({ length: maxLen }, (_, i) => i),
                datasets
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    x: { title: { display: true, text: 'Removal Step' } },
                    y: {
                        title: { display: true, text: 'LCC Size (fraction)' },
                        min: 0, max: 1
                    }
                }
            }
        });
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
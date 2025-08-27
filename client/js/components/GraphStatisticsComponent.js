/**
 * Graph Statistics Component
 * Displays comprehensive graph statistics with expandable interface and degree distribution visualization
 */
class GraphStatisticsComponent extends BaseComponent {
    getDefaultOptions() {
        return {
            showAdvancedStats: true,
            showDegreeDistribution: true,
            expandable: true,
            chartOptions: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        };
    }
    
    init() {
        console.log('GraphStatisticsComponent: Initializing...');
        this.currentGraph = null;
        this.currentStats = null;
        this.isExpanded = false;
        this.degreeDistributionChart = null;
        
        try {
            super.init();
            console.log('GraphStatisticsComponent: Initialization complete');
        } catch (error) {
            console.error('GraphStatisticsComponent: Error during initialization:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        super.setupEventListeners();
        
        // Listen for graph loaded events
        this.on('graph:loaded', (data) => {
            console.log('GraphStatisticsComponent: Received graph:loaded event', data);
            this.handleGraphLoaded(data.graphData, data.graphInfo);
        });
        
        // Listen for graph cleared events
        this.on('graph:cleared', () => {
            console.log('GraphStatisticsComponent: Received graph:cleared event');
            this.handleGraphCleared();
        });
        
        // Setup expand/collapse functionality
        this.setupExpandCollapseListeners();
    }
    
    setupExpandCollapseListeners() {
        const expandBtn = this.container.querySelector('.stats-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                this.toggleExpanded();
            });
        }
    }
    
    render() {
        console.log('GraphStatisticsComponent: render() called', {
            hasGraph: !!this.currentGraph,
            hasStats: !!this.currentStats,
            isExpanded: this.isExpanded
        });
        
        try {
            if (!this.currentGraph || !this.currentStats) {
                console.log('GraphStatisticsComponent: Rendering empty state');
                this.renderEmptyState();
                return;
            }
            
            console.log('GraphStatisticsComponent: Rendering statistics');
            this.renderStatistics();
            this.updateExpandedState();
            
            if (this.isExpanded && this.options.showDegreeDistribution) {
                console.log('GraphStatisticsComponent: Rendering degree distribution');
                this.renderDegreeDistribution();
            }
        } catch (error) {
            console.error('GraphStatisticsComponent: Error during render:', error);
            this.showError('Error rendering statistics: ' + error.message);
        }
    }
    
    renderEmptyState() {
        this.container.innerHTML = `
            <div class="card" id="graph-statistics">
                <div class="card-header">
                    <h5><i class="fas fa-chart-bar"></i> Graph Statistics</h5>
                </div>
                <div class="card-body">
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-chart-bar fa-3x mb-3"></i>
                        <p>Upload a graph to see detailed statistics</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderStatistics() {
        const stats = this.currentStats;
        console.log('GraphStatisticsComponent: renderStatistics called with stats:', stats);
        
        // Safety check to prevent rendering with invalid stats
        if (!stats || typeof stats !== 'object') {
            console.error('GraphStatisticsComponent: Invalid stats object, rendering empty state');
            this.renderEmptyState();
            return;
        }
        
        this.container.innerHTML = `
            <div class="card" id="graph-statistics">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5><i class="fas fa-chart-bar"></i> Graph Statistics</h5>
                    ${this.options.expandable ? `
                        <button class="btn btn-sm btn-outline-secondary stats-expand-btn" type="button">
                            <i class="fas fa-${this.isExpanded ? 'compress' : 'expand'}-alt"></i>
                            ${this.isExpanded ? 'Collapse' : 'Expand'}
                        </button>
                    ` : ''}
                </div>
                <div class="card-body">
                    <!-- Basic Statistics -->
                    <div class="row mb-3">
                        <div class="col-md-3 col-6">
                            <div class="stat-item">
                                <div class="stat-value text-primary">${stats.num_nodes.toLocaleString()}</div>
                                <div class="stat-label">Nodes</div>
                            </div>
                        </div>
                        <div class="col-md-3 col-6">
                            <div class="stat-item">
                                <div class="stat-value text-success">${stats.num_edges.toLocaleString()}</div>
                                <div class="stat-label">Edges</div>
                            </div>
                        </div>
                        <div class="col-md-3 col-6">
                            <div class="stat-item">
                                <div class="stat-value text-info">${stats.density.toFixed(4)}</div>
                                <div class="stat-label">Density</div>
                            </div>
                        </div>
                        <div class="col-md-3 col-6">
                            <div class="stat-item">
                                <div class="stat-value ${stats.is_connected ? 'text-success' : 'text-warning'}">
                                    <i class="fas fa-${stats.is_connected ? 'check-circle' : 'exclamation-triangle'}"></i>
                                    ${stats.is_connected ? 'Yes' : 'No'}
                                </div>
                                <div class="stat-label">Connected</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Advanced Statistics (expandable) -->
                    <div class="advanced-stats ${this.isExpanded ? '' : 'd-none'}">
                        <hr>
                        <h6 class="mb-3"><i class="fas fa-microscope"></i> Advanced Metrics</h6>
                        
                        <div class="row mb-3">
                            ${stats.clustering_coefficient !== undefined ? `
                                <div class="col-md-4 col-6">
                                    <div class="stat-item">
                                        <div class="stat-value text-purple">${stats.clustering_coefficient.toFixed(4)}</div>
                                        <div class="stat-label">Clustering Coefficient</div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${stats.average_path_length !== undefined ? `
                                <div class="col-md-4 col-6">
                                    <div class="stat-item">
                                        <div class="stat-value text-orange">${stats.average_path_length.toFixed(4)}</div>
                                        <div class="stat-label">Avg Path Length</div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${stats.degree_stats ? `
                                <div class="col-md-4 col-6">
                                    <div class="stat-item">
                                        <div class="stat-value text-teal">${stats.degree_stats.max}</div>
                                        <div class="stat-label">Max Degree</div>
                                    </div>
                                </div>
                                <div class="col-md-4 col-6">
                                    <div class="stat-item">
                                        <div class="stat-value text-indigo">${stats.degree_stats.avg.toFixed(2)}</div>
                                        <div class="stat-label">Avg Degree</div>
                                    </div>
                                </div>
                                <div class="col-md-4 col-6">
                                    <div class="stat-item">
                                        <div class="stat-value text-pink">${stats.degree_stats.std.toFixed(2)}</div>
                                        <div class="stat-label">Degree Std Dev</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- Degree Distribution Chart -->
                        ${this.options.showDegreeDistribution ? `
                            <div class="degree-distribution-section">
                                <h6 class="mb-3"><i class="fas fa-chart-histogram"></i> Degree Distribution</h6>
                                <div class="chart-container" style="position: relative; height: 300px;">
                                    <canvas id="degreeDistributionChart"></canvas>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Loading indicator for advanced stats -->
                    <div class="advanced-stats-loading d-none">
                        <div class="text-center py-3">
                            <div class="spinner-border spinner-border-sm text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <span class="ms-2">Calculating advanced statistics...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Re-setup event listeners after rendering
        this.setupExpandCollapseListeners();
    }
    
    updateExpandedState() {
        const expandBtn = this.container.querySelector('.stats-expand-btn');
        const advancedStats = this.container.querySelector('.advanced-stats');
        
        if (expandBtn) {
            const icon = expandBtn.querySelector('i');
            const text = expandBtn.childNodes[expandBtn.childNodes.length - 1];
            
            if (this.isExpanded) {
                icon.className = 'fas fa-compress-alt';
                text.textContent = ' Collapse';
                if (advancedStats) advancedStats.classList.remove('d-none');
            } else {
                icon.className = 'fas fa-expand-alt';
                text.textContent = ' Expand';
                if (advancedStats) advancedStats.classList.add('d-none');
            }
        }
    }
    
    toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        this.setState({ expanded: this.isExpanded });
        
        if (this.isExpanded && this.currentStats && this.options.showDegreeDistribution) {
            // Delay chart rendering to allow DOM to update
            setTimeout(() => {
                this.renderDegreeDistribution();
            }, 100);
        }
        
        this.updateExpandedState();
        this.emit('stats:expanded-changed', { expanded: this.isExpanded });
    }
    
    async handleGraphLoaded(graphData, graphInfo) {
        console.log('GraphStatisticsComponent: handleGraphLoaded called', { graphData, graphInfo });
        
        this.currentGraph = graphData;
        
        // Normalize the graph info to handle different server response formats
        this.currentStats = this.normalizeGraphInfo(graphInfo);
        console.log('Normalized stats:', this.currentStats);
        
        // Show loading state
        this.showLoading('Calculating statistics...');
        
        try {
            // Calculate additional statistics if not provided
            if (this.options.showAdvancedStats) {
                await this.calculateAdvancedStatistics(graphData, this.currentStats);
            }
            
            this.setState({ 
                graphLoaded: true,
                error: null
            });
            
            this.render();
            
        } catch (error) {
            console.error('Error calculating statistics:', error);
            this.showError('Error calculating statistics: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    normalizeGraphInfo(graphInfo) {
        // Handle different server response formats
        if (!graphInfo || typeof graphInfo !== 'object') {
            console.warn('GraphStatisticsComponent: Invalid or missing graphInfo, using defaults');
            return {
                num_nodes: 0,
                num_edges: 0,
                density: 0,
                is_connected: false
            };
        }
        
        const normalized = { ...graphInfo };
        
        // Convert 'nodes' to 'num_nodes' if needed
        if (graphInfo.nodes !== undefined && graphInfo.num_nodes === undefined) {
            normalized.num_nodes = graphInfo.nodes;
        }
        
        // Convert 'edges' to 'num_edges' if needed
        if (graphInfo.edges !== undefined && graphInfo.num_edges === undefined) {
            normalized.num_edges = graphInfo.edges;
        }
        
        // Ensure we have the required fields with safe defaults
        if (normalized.num_nodes === undefined || normalized.num_nodes === null) {
            normalized.num_nodes = 0;
        }
        if (normalized.num_edges === undefined || normalized.num_edges === null) {
            normalized.num_edges = 0;
        }
        if (normalized.density === undefined || normalized.density === null) {
            normalized.density = 0;
        }
        if (normalized.is_connected === undefined || normalized.is_connected === null) {
            normalized.is_connected = false;
        }
        
        // Ensure numeric values are actually numbers
        normalized.num_nodes = Number(normalized.num_nodes) || 0;
        normalized.num_edges = Number(normalized.num_edges) || 0;
        normalized.density = Number(normalized.density) || 0;
        
        return normalized;
    }
    
    handleGraphCleared() {
        this.currentGraph = null;
        this.currentStats = null;
        this.isExpanded = false;
        
        // Destroy existing chart
        if (this.degreeDistributionChart) {
            this.degreeDistributionChart.destroy();
            this.degreeDistributionChart = null;
        }
        
        this.setState({ 
            graphLoaded: false,
            expanded: false,
            error: null
        });
        
        this.render();
    }
    
    async calculateAdvancedStatistics(graphData, graphInfo) {
        // Calculate degree distribution and statistics
        const degreeStats = this.calculateDegreeStatistics(graphData);
        
        // Update current stats with calculated values
        this.currentStats = {
            ...graphInfo,
            degree_stats: degreeStats.stats,
            degree_distribution: degreeStats.distribution
        };
        
        // If clustering coefficient and path length are not provided, 
        // we could calculate them here, but for large graphs this might be expensive
        // For now, we'll leave them as optional
        
        return this.currentStats;
    }
    
    calculateDegreeStatistics(graphData) {
        const degrees = new Map();
        
        // Initialize all nodes with degree 0
        if (graphData.nodes) {
            graphData.nodes.forEach(node => {
                const nodeId = typeof node === 'object' ? node.id : node;
                degrees.set(nodeId, 0);
            });
        }
        
        // Count degrees from edges
        if (graphData.edges) {
            graphData.edges.forEach(edge => {
                const source = Array.isArray(edge) ? edge[0] : edge.source;
                const target = Array.isArray(edge) ? edge[1] : edge.target;
                
                degrees.set(source, (degrees.get(source) || 0) + 1);
                degrees.set(target, (degrees.get(target) || 0) + 1);
            });
        }
        
        const degreeValues = Array.from(degrees.values());
        const maxDegree = Math.max(...degreeValues);
        const minDegree = Math.min(...degreeValues);
        const avgDegree = degreeValues.reduce((sum, d) => sum + d, 0) / degreeValues.length;
        
        // Calculate standard deviation
        const variance = degreeValues.reduce((sum, d) => sum + Math.pow(d - avgDegree, 2), 0) / degreeValues.length;
        const stdDev = Math.sqrt(variance);
        
        // Create degree distribution histogram
        const distribution = new Array(maxDegree + 1).fill(0);
        degreeValues.forEach(degree => {
            distribution[degree]++;
        });
        
        return {
            stats: {
                max: maxDegree,
                min: minDegree,
                avg: avgDegree,
                std: stdDev
            },
            distribution: distribution
        };
    }
    
    renderDegreeDistribution() {
        if (!this.currentStats || !this.currentStats.degree_distribution) {
            return;
        }
        
        const canvas = this.container.querySelector('#degreeDistributionChart');
        if (!canvas) {
            return;
        }
        
        // Destroy existing chart
        if (this.degreeDistributionChart) {
            this.degreeDistributionChart.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        const distribution = this.currentStats.degree_distribution;
        
        // Prepare data for Chart.js
        const labels = distribution.map((_, index) => index.toString());
        const data = distribution;
        
        // Filter out zero values for better visualization
        const filteredData = [];
        const filteredLabels = [];
        distribution.forEach((count, degree) => {
            if (count > 0) {
                filteredData.push(count);
                filteredLabels.push(degree.toString());
            }
        });
        
        this.degreeDistributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: filteredLabels,
                datasets: [{
                    label: 'Number of Nodes',
                    data: filteredData,
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                ...this.options.chartOptions,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Degree'
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Number of Nodes'
                        },
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Degree Distribution'
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return `Degree: ${context[0].label}`;
                            },
                            label: function(context) {
                                const total = filteredData.reduce((sum, val) => sum + val, 0);
                                const percentage = ((context.parsed.y / total) * 100).toFixed(1);
                                return `Nodes: ${context.parsed.y} (${percentage}%)`;
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                }
            }
        });
        
        // Add zoom functionality
        this.addChartZoomFunctionality(canvas);
    }
    
    addChartZoomFunctionality(canvas) {
        let isZoomed = false;
        
        // Add double-click to reset zoom
        canvas.addEventListener('dblclick', () => {
            if (this.degreeDistributionChart && isZoomed) {
                this.degreeDistributionChart.resetZoom();
                isZoomed = false;
            }
        });
        
        // Add mouse wheel zoom (optional - can be enabled if Chart.js zoom plugin is available)
        if (typeof Chart.Zoom !== 'undefined') {
            this.degreeDistributionChart.options.plugins.zoom = {
                zoom: {
                    wheel: {
                        enabled: true,
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x',
                    onZoom: () => {
                        isZoomed = true;
                    }
                },
                pan: {
                    enabled: true,
                    mode: 'x'
                }
            };
            this.degreeDistributionChart.update();
        }
    }
    
    // Public methods for external access
    getStatistics() {
        return this.currentStats;
    }
    
    isGraphLoaded() {
        return this.currentGraph !== null;
    }
    
    exportStatistics() {
        if (!this.currentStats) {
            return null;
        }
        
        const exportData = {
            basic_stats: {
                nodes: this.currentStats.num_nodes,
                edges: this.currentStats.num_edges,
                density: this.currentStats.density,
                is_connected: this.currentStats.is_connected
            },
            advanced_stats: {},
            degree_distribution: this.currentStats.degree_distribution,
            export_timestamp: new Date().toISOString()
        };
        
        // Add advanced stats if available
        if (this.currentStats.clustering_coefficient !== undefined) {
            exportData.advanced_stats.clustering_coefficient = this.currentStats.clustering_coefficient;
        }
        if (this.currentStats.average_path_length !== undefined) {
            exportData.advanced_stats.average_path_length = this.currentStats.average_path_length;
        }
        if (this.currentStats.degree_stats) {
            exportData.advanced_stats.degree_stats = this.currentStats.degree_stats;
        }
        
        return exportData;
    }
    
    // Cleanup method
    destroy() {
        if (this.degreeDistributionChart) {
            this.degreeDistributionChart.destroy();
            this.degreeDistributionChart = null;
        }
        super.destroy();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphStatisticsComponent;
}
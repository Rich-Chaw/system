// FINDER_ND Client Application
class FinderNDClient {
    constructor() {
        this.serverUrl = 'http://localhost:5000';
        this.currentGraph = null;
        this.currentResults = null;
        this.graphViz = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkServerStatus();
        this.loadAvailableModels();
        this.initializeGraphVisualization();
    }
    
    setupEventListeners() {
        // File upload
        document.getElementById('graphFile').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });
        
        // Manual input
        document.getElementById('graphInput').addEventListener('input', (e) => {
            this.handleManualInput(e.target.value);
        });
        
        // Dismantle button
        document.getElementById('dismantleBtn').addEventListener('click', () => {
            this.startDismantling();
        });
        
        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAll();
        });
        
        // Export buttons
        document.getElementById('exportSolution').addEventListener('click', () => {
            this.exportSolution();
        });
        
        document.getElementById('exportResults').addEventListener('click', () => {
            this.exportResults();
        });
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
            statusElement.title = `Server healthy. Models: ${data.available_models.length}`;
        } else {
            statusElement.innerHTML = '<i class="fas fa-circle status-disconnected"></i> Disconnected';
            statusElement.title = 'Cannot connect to server';
        }
    }
    
    async loadAvailableModels() {
        try {
            const response = await fetch(`${this.serverUrl}/api/models`);
            const data = await response.json();
            
            if (data.success) {
                this.populateModelSelect(data.models);
            }
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }
    
    populateModelSelect(models) {
        const select = document.getElementById('modelSelect');
        select.innerHTML = '';
        
        if (models.length === 0) {
            select.innerHTML = '<option value="">No models available</option>';
            return;
        }
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `${model.name} ${model.loaded ? '(Loaded)' : ''}`;
            select.appendChild(option);
        });
    }
    
    async handleFileUpload(file) {
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            this.showProgress('Uploading file...');
            
            const response = await fetch(`${this.serverUrl}/api/upload_graph`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentGraph = data.graph_data;
                this.displayGraphInfo(data.graph_info);
                this.visualizeGraph(data.graph_data);
                this.enableDismantleButton();
            } else {
                this.showError('Upload failed: ' + data.error);
            }
        } catch (error) {
            this.showError('Upload failed: ' + error.message);
        } finally {
            this.hideProgress();
        }
    }
    
    handleManualInput(text) {
        if (!text.trim()) {
            this.clearGraph();
            return;
        }
        
        try {
            // Parse as edge list
            const lines = text.trim().split('\n');
            const edges = [];
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    edges.push([parseInt(parts[0]), parseInt(parts[1])]);
                }
            }
            
            if (edges.length > 0) {
                const graphData = { edges: edges };
                this.currentGraph = graphData;
                
                // Calculate basic info
                const nodes = new Set();
                edges.forEach(edge => {
                    nodes.add(edge[0]);
                    nodes.add(edge[1]);
                });
                
                const graphInfo = {
                    nodes: nodes.size,
                    edges: edges.length,
                    density: (2 * edges.length) / (nodes.size * (nodes.size - 1))
                };
                
                this.displayGraphInfo(graphInfo);
                this.visualizeGraph(graphData);
                this.enableDismantleButton();
            }
        } catch (error) {
            console.error('Error parsing manual input:', error);
        }
    }
    
    displayGraphInfo(info) {
        const infoDiv = document.getElementById('graphInfo');
        const statsDiv = document.getElementById('graphStats');
        
        statsDiv.innerHTML = `
            <div class="row">
                <div class="col-6"><strong>Nodes:</strong> ${info.nodes}</div>
                <div class="col-6"><strong>Edges:</strong> ${info.edges}</div>
                <div class="col-6"><strong>Density:</strong> ${info.density?.toFixed(3) || 'N/A'}</div>
                <div class="col-6"><strong>Connected:</strong> ${info.is_connected ? 'Yes' : 'No'}</div>
            </div>
        `;
        
        infoDiv.classList.remove('d-none');
    }
    
    enableDismantleButton() {
        document.getElementById('dismantleBtn').disabled = false;
    }
    
    async startDismantling() {
        if (!this.currentGraph) {
            this.showError('No graph loaded');
            return;
        }
        
        const model = document.getElementById('modelSelect').value;
        const stepRatio = parseFloat(document.getElementById('stepRatio').value);
        const maxIterations = parseInt(document.getElementById('maxIterations').value);
        
        const requestData = {
            graph: this.currentGraph,
            model: model,
            step_ratio: stepRatio,
            max_iterations: maxIterations
        };
        
        try {
            this.showProgress('Starting dismantling...');
            this.updateServerStatus(false, null); // Show processing
            document.getElementById('server-status').innerHTML = '<i class="fas fa-circle status-processing"></i> Processing';
            
            const response = await fetch(`${this.serverUrl}/api/dismantle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentResults = data.result;
                this.displayResults(data.result);
                this.visualizeDismantling(data.result);
            } else {
                this.showError('Dismantling failed: ' + data.error);
            }
        } catch (error) {
            this.showError('Dismantling failed: ' + error.message);
        } finally {
            this.hideProgress();
            this.checkServerStatus(); // Restore server status
        }
    }
    
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
    
    initializeGraphVisualization() {
        const container = document.getElementById('graphViz');
        const width = container.clientWidth;
        const height = 400;
        
        this.graphViz = d3.select('#graphViz')
            .append('svg')
            .attr('width', width)
            .attr('height', height);
    }
    
    visualizeGraph(graphData) {
        if (!this.graphViz) return;
        
        // Clear previous visualization
        this.graphViz.selectAll('*').remove();
        
        // Prepare data
        const nodes = [];
        const links = [];
        const nodeSet = new Set();
        
        // Extract nodes and edges
        if (graphData.edges) {
            graphData.edges.forEach(edge => {
                nodeSet.add(edge[0]);
                nodeSet.add(edge[1]);
                links.push({ source: edge[0], target: edge[1] });
            });
        }
        
        nodeSet.forEach(nodeId => {
            nodes.push({ id: nodeId });
        });
        
        if (nodes.length === 0) return;
        
        const width = this.graphViz.attr('width');
        const height = this.graphViz.attr('height');
        
        // Create force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(50))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(width / 2, height / 2));
        
        // Add links
        const link = this.graphViz.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('class', 'link');
        
        // Add nodes
        const node = this.graphViz.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', 5)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Add labels for small graphs
        if (nodes.length < 50) {
            const labels = this.graphViz.append('g')
                .selectAll('text')
                .data(nodes)
                .enter().append('text')
                .text(d => d.id)
                .attr('font-size', '10px')
                .attr('text-anchor', 'middle')
                .attr('dy', '.35em');
            
            simulation.on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                
                node
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);
                
                labels
                    .attr('x', d => d.x)
                    .attr('y', d => d.y);
            });
        } else {
            simulation.on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                
                node
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);
            });
        }
        
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }
    
    visualizeDismantling(results) {
        // Highlight removed nodes in the visualization
        if (!this.graphViz) return;
        
        const removedNodes = new Set(results.solution);
        
        this.graphViz.selectAll('.node')
            .classed('removed', d => removedNodes.has(d.id));
    }
    
    showProgress(message) {
        document.getElementById('progressCard').style.display = 'block';
        document.getElementById('progressText').textContent = message;
        document.getElementById('progressBar').style.width = '100%';
    }
    
    hideProgress() {
        document.getElementById('progressCard').style.display = 'none';
    }
    
    showError(message) {
        alert('Error: ' + message); // Simple error display
    }
    
    clearAll() {
        this.currentGraph = null;
        this.currentResults = null;
        
        document.getElementById('graphFile').value = '';
        document.getElementById('graphInput').value = '';
        document.getElementById('graphInfo').classList.add('d-none');
        document.getElementById('resultsCard').style.display = 'none';
        document.getElementById('dismantleBtn').disabled = true;
        
        if (this.graphViz) {
            this.graphViz.selectAll('*').remove();
        }
    }
    
    clearGraph() {
        this.currentGraph = null;
        document.getElementById('graphInfo').classList.add('d-none');
        document.getElementById('dismantleBtn').disabled = true;
        
        if (this.graphViz) {
            this.graphViz.selectAll('*').remove();
        }
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
    new FinderNDClient();
});
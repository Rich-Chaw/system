/**
 * Visualization Component
 * Handles graph visualization using D3.js
 */
class VisualizationComponent extends BaseComponent {
    getDefaultOptions() {
        return {
            width: 800,
            height: 400,
            nodeRadius: 5,
            linkDistance: 50,
            chargeStrength: -100,
            showLabels: true,
            maxNodesForLabels: 50
        };
    }
    
    init() {
        console.log('VisualizationComponent.init() called for container:', this.containerId);
        
        this.simulation = null;
        this.svg = null;
        this.currentGraphData = null;
        this.removedNodes = new Set();
        this.pendingGraphData = null;
        
        super.init();
        
        console.log('VisualizationComponent initialized, container element:', this.container);
        
        // Listen for graph events
        this.on('graph:loaded', (data) => {
            console.log('VisualizationComponent received graph:loaded event:', data);
            console.log('Graph data structure:', data.graphData);
            console.log('SVG initialized:', !!this.svg);
            
            // Force re-initialization if needed
            if (!this.svg) {
                console.log('SVG not ready, initializing and then visualizing');
                this.initializeVisualization();
            }
            
            // Always try to visualize the graph
            this.visualizeGraph(data.graphData);
        });
        
        // Also listen directly on the event bus for debugging
        this.eventBus.on('graph:loaded', (data) => {
            console.log('VisualizationComponent: Direct eventBus listener received graph:loaded:', data);
        });
        
        this.on('graph:cleared', () => {
            this.clearVisualization();
        });
        
        this.on('dismantling:progress', (data) => {
            this.updateDismantlingVisualization(data);
        });
        
        console.log('VisualizationComponent event listeners set up');
    }
    
    setupEventListeners() {
        super.setupEventListeners();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    render() {
        this.initializeVisualization();
        
        // If we have pending graph data, visualize it now
        if (this.pendingGraphData) {
            console.log('Rendering pending graph data:', this.pendingGraphData);
            this.visualizeGraph(this.pendingGraphData);
            this.pendingGraphData = null;
        }
    }
    
    initializeVisualization() {
        console.log('initializeVisualization called');
        console.log('this.container:', this.container);
        console.log('this.containerId:', this.containerId);
        
        const container = this.container.querySelector('#graphViz');
        console.log('Searching for #graphViz in container:', this.container);
        console.log('Found graphViz container:', container);
        
        if (!container) {
            console.error('graphViz container not found in', this.container);
            console.error('Available elements in container:', this.container.innerHTML);
            return;
        }
        
        // Clear existing visualization
        container.innerHTML = '';
        
        const width = container.clientWidth || this.options.width;
        const height = this.options.height;
        
        console.log('Creating SVG with dimensions:', { width, height });
        
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                this.svg.select('.graph-container')
                    .attr('transform', event.transform);
            });
        
        this.svg.call(zoom);
        
        // Create container for graph elements
        this.svg.append('g')
            .attr('class', 'graph-container');
            
        console.log('SVG initialized successfully');
    }
    
    visualizeGraph(graphData) {
        console.log('VisualizationComponent.visualizeGraph called with:', graphData);
        
        if (!graphData) {
            console.log('No graphData provided');
            return;
        }
        
        // Ensure SVG is initialized
        if (!this.svg) {
            console.log('SVG not initialized, initializing now...');
            this.initializeVisualization();
        }
        
        if (!this.svg) {
            console.error('Failed to initialize SVG');
            return;
        }
        
        this.currentGraphData = graphData;
        this.removedNodes.clear();
        
        // Clear previous visualization
        this.svg.select('.graph-container').selectAll('*').remove();
        
        // Prepare data
        const nodes = [];
        const links = [];
        const nodeSet = new Set();
        
        // Extract nodes and edges
        if (graphData.edges) {
            console.log('Processing edges:', graphData.edges.length);
            graphData.edges.forEach(edge => {
                nodeSet.add(edge[0]);
                nodeSet.add(edge[1]);
                links.push({ 
                    source: edge[0], 
                    target: edge[1],
                    id: `${edge[0]}-${edge[1]}`
                });
            });
        } else {
            console.log('No edges found in graphData');
        }
        
        nodeSet.forEach(nodeId => {
            nodes.push({ 
                id: nodeId,
                removed: false
            });
        });
        
        console.log('Prepared visualization data:', { nodes: nodes.length, links: links.length });
        
        if (nodes.length === 0) {
            console.log('No nodes to visualize');
            return;
        }
        
        const width = parseInt(this.svg.attr('width'));
        const height = parseInt(this.svg.attr('height'));
        
        console.log('SVG dimensions for simulation:', { width, height });
        
        // Adjust parameters based on graph size
        const nodeCount = nodes.length;
        let nodeRadius, linkDistance, chargeStrength;
        
        if (nodeCount > 500) {
            nodeRadius = 2;
            linkDistance = 20;
            chargeStrength = -30;
        } else if (nodeCount > 100) {
            nodeRadius = 3;
            linkDistance = 30;
            chargeStrength = -50;
        } else if (nodeCount > 20) {
            nodeRadius = 4;
            linkDistance = 40;
            chargeStrength = -80;
        } else {
            nodeRadius = this.options.nodeRadius;
            linkDistance = this.options.linkDistance;
            chargeStrength = this.options.chargeStrength;
        }
        
        console.log('Using parameters for', nodeCount, 'nodes:', {
            nodeRadius, linkDistance, chargeStrength
        });
        
        // Create force simulation with adjusted parameters
        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(linkDistance))
            .force('charge', d3.forceManyBody().strength(chargeStrength))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(nodeRadius + 1))
            .alpha(1)
            .alphaDecay(0.02);
        
        const container = this.svg.select('.graph-container');
        
        // Add links with adjusted styling
        const link = container.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', nodeCount > 100 ? 0.3 : 0.6)
            .attr('stroke-width', nodeCount > 500 ? 0.5 : 1);
        
        console.log('Created links:', link.size());
        
        // Add nodes with adjusted styling
        const node = container.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', nodeRadius)
            .attr('fill', '#69b3a2')
            .attr('stroke', '#fff')
            .attr('stroke-width', nodeCount > 100 ? 0.5 : 2)
            .attr('opacity', nodeCount > 500 ? 0.8 : 1)
            .call(this.createDragBehavior());
            
        console.log('Created nodes:', node.size());
        
        // Add labels for small graphs only
        let labels = null;
        if (this.options.showLabels && nodes.length <= this.options.maxNodesForLabels) {
            labels = container.append('g')
                .attr('class', 'labels')
                .selectAll('text')
                .data(nodes)
                .enter().append('text')
                .text(d => d.id)
                .attr('font-size', nodeCount > 20 ? '8px' : '10px')
                .attr('text-anchor', 'middle')
                .attr('dy', '.35em')
                .attr('pointer-events', 'none');
        }
        
        // Add zoom behavior for larger graphs
        if (nodeCount > 50) {
            const zoom = d3.zoom()
                .scaleExtent([0.1, 10])
                .on('zoom', (event) => {
                    container.attr('transform', event.transform);
                });
            
            this.svg.call(zoom);
        }
        
        // Update positions on simulation tick
        let tickCount = 0;
        this.simulation.on('tick', () => {
            tickCount++;
            if (tickCount <= 5) {
                console.log(`Simulation tick ${tickCount}, node positions:`, nodes.slice(0, 2).map(n => ({ id: n.id, x: n.x, y: n.y })));
            }
            
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            if (labels) {
                labels
                    .attr('x', d => d.x)
                    .attr('y', d => d.y);
            }
        });
        
        // For large graphs, stop simulation after a reasonable time
        if (nodeCount > 100) {
            setTimeout(() => {
                this.simulation.alpha(0);
                console.log('Stopped simulation for large graph');
            }, 5000);
        }
        
        // Store references for later updates
        this.nodes = nodes;
        this.links = links;
        this.nodeSelection = node;
        this.linkSelection = link;
        this.labelSelection = labels;
        
        this.setState({ graphVisualized: true });
        this.emit('visualization:ready', { nodeCount: nodes.length, linkCount: links.length });
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
    
    updateDismantlingVisualization(data) {
        if (!this.nodeSelection || !data.removedNodes) return;
        
        // Update removed nodes set
        data.removedNodes.forEach(nodeId => {
            this.removedNodes.add(nodeId);
        });
        
        // Update node appearance
        this.nodeSelection
            .classed('removed', d => this.removedNodes.has(d.id))
            .attr('fill', d => this.removedNodes.has(d.id) ? '#ff6b6b' : '#69b3a2')
            .attr('opacity', d => this.removedNodes.has(d.id) ? 0.7 : 1);
        
        // Update link appearance
        if (this.linkSelection) {
            this.linkSelection
                .classed('removed', d => 
                    this.removedNodes.has(d.source.id) || this.removedNodes.has(d.target.id))
                .attr('stroke', d => 
                    this.removedNodes.has(d.source.id) || this.removedNodes.has(d.target.id) ? '#ccc' : '#999')
                .attr('stroke-opacity', d => 
                    this.removedNodes.has(d.source.id) || this.removedNodes.has(d.target.id) ? 0.3 : 0.6);
        }
        
        this.emit('visualization:updated', { 
            removedCount: this.removedNodes.size,
            totalNodes: this.nodes ? this.nodes.length : 0
        });
    }
    
    clearVisualization() {
        if (this.svg) {
            this.svg.select('.graph-container').selectAll('*').remove();
        }
        
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
        
        this.currentGraphData = null;
        this.removedNodes.clear();
        this.nodes = null;
        this.links = null;
        this.nodeSelection = null;
        this.linkSelection = null;
        this.labelSelection = null;
        
        this.setState({ graphVisualized: false });
        this.emit('visualization:cleared');
    }
    
    handleResize() {
        if (!this.svg) return;
        
        const container = this.container.querySelector('#graphViz');
        if (!container) return;
        
        const width = container.clientWidth;
        const height = this.options.height;
        
        this.svg
            .attr('width', width)
            .attr('height', height);
        
        if (this.simulation) {
            this.simulation
                .force('center', d3.forceCenter(width / 2, height / 2))
                .alpha(0.3)
                .restart();
        }
    }
    
    // Method to highlight specific nodes
    highlightNodes(nodeIds, className = 'highlighted') {
        if (!this.nodeSelection) return;
        
        this.nodeSelection
            .classed(className, d => nodeIds.includes(d.id));
    }
    
    // Method to reset all highlights
    resetHighlights() {
        if (!this.nodeSelection) return;
        
        this.nodeSelection
            .attr('class', 'node')
            .classed('removed', d => this.removedNodes.has(d.id));
    }
    
    // Get current visualization state
    getVisualizationState() {
        return {
            hasGraph: !!this.currentGraphData,
            nodeCount: this.nodes ? this.nodes.length : 0,
            linkCount: this.links ? this.links.length : 0,
            removedCount: this.removedNodes.size
        };
    }
    
    // Test method to verify the component is working
    testVisualization() {
        console.log('=== VisualizationComponent Test ===');
        console.log('Container:', this.container);
        console.log('Container ID:', this.containerId);
        console.log('SVG initialized:', !!this.svg);
        
        const testData = {
            edges: [[0, 1], [1, 2], [2, 0]]
        };
        
        console.log('Testing with data:', testData);
        this.visualizeGraph(testData);
    }
}
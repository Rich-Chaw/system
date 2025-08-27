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
            console.log('VisualizationComponent: Graph data structure:', data.graphData);
            console.log('VisualizationComponent: SVG initialized:', !!this.svg);
            
            // Force re-initialization if needed
            if (!this.svg) {
                console.log('VisualizationComponent: SVG not ready, initializing and then visualizing');
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
        console.log('VisualizationComponent: initializeVisualization called');
        console.log('VisualizationComponent: this.container:', this.container);
        console.log('VisualizationComponent: this.containerId:', this.containerId);
        
        const container = this.container.querySelector('#graphViz');
        console.log('VisualizationComponent: Searching for #graphViz in container:', this.container);
        console.log('VisualizationComponent: Found graphViz container:', !!container);
        
        if (!container) {
            console.error('VisualizationComponent: graphViz container not found in', this.container);
            console.error('VisualizationComponent: Available elements in container:', this.container.innerHTML);
            return;
        }
        
        // Clear existing visualization
        container.innerHTML = '';
        
        const width = container.clientWidth || this.options.width;
        const height = this.options.height;
        
        console.log('VisualizationComponent: Creating SVG with dimensions:', { width, height });
        
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background-color', '#f0f0f0')
            .style('border', '2px solid #007bff');
        
        // Add a test circle to verify SVG is working
        this.svg.append('circle')
            .attr('cx', 50)
            .attr('cy', 50)
            .attr('r', 20)
            .attr('fill', 'red');
        
        // Add test text
        this.svg.append('text')
            .attr('x', 100)
            .attr('y', 50)
            .text('SVG Initialized')
            .attr('fill', 'black');
        
        // Create container for graph elements (same as working MultiView and Simple)
        this.graphContainer = this.svg.append('g')
            .attr('class', 'graph-container');
        
        // Add a test rectangle to the graph container to verify it's working
        this.graphContainer.append('rect')
            .attr('x', 150)
            .attr('y', 150)
            .attr('width', 100)
            .attr('height', 50)
            .attr('fill', 'blue')
            .attr('opacity', 0.5);
        
        console.log('VisualizationComponent: SVG initialized successfully');
        console.log('VisualizationComponent: GraphContainer created:', this.graphContainer.node());
    }
    
    visualizeGraph(graphData) {
        console.log('VisualizationComponent.visualizeGraph called with:', graphData);
        console.log('VisualizationComponent: graphData type:', typeof graphData);
        console.log('VisualizationComponent: graphData keys:', graphData ? Object.keys(graphData) : 'null');
        console.log('VisualizationComponent: graphData.edges:', graphData ? graphData.edges : 'no edges');
        
        if (!graphData) {
            console.log('VisualizationComponent: No graphData provided');
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
        
        // Clear previous visualization but keep test elements
        if (this.graphContainer) {
            this.graphContainer.selectAll('*').remove();
        } else {
            this.graphContainer = this.svg.append('g').attr('class', 'graph-container');
        }
        
        // Prepare data
        const nodes = [];
        const links = [];
        const nodeSet = new Set();
        
        // Extract nodes and edges - handle both formats: [source, target] and {source, target}
        if (graphData.edges) {
            console.log('Processing edges:', graphData.edges.length);
            graphData.edges.forEach(edge => {
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
        } else {
            console.log('No edges found in graphData');
        }
        
        nodeSet.forEach(nodeId => {
            nodes.push({ id: nodeId });
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
        let nodeRadius, linkDistance, chargeStrength, linkStrokeWidth;
        
        if (nodeCount > 500) {
            // Very large graphs
            nodeRadius = 2;
            linkDistance = 20;
            chargeStrength = -30;
            linkStrokeWidth = 0.5;
        } else if (nodeCount > 100) {
            // Large graphs
            nodeRadius = 3;
            linkDistance = 30;
            chargeStrength = -50;
            linkStrokeWidth = 1;
        } else if (nodeCount > 20) {
            // Medium graphs
            nodeRadius = 4;
            linkDistance = 40;
            chargeStrength = -80;
            linkStrokeWidth = 1;
        } else {
            // Small graphs
            nodeRadius = 6;
            linkDistance = 50;
            chargeStrength = -100;
            linkStrokeWidth = 2;
        }
        
        console.log('VisualizationComponent: Using parameters for', nodeCount, 'nodes:', {
            nodeRadius, linkDistance, chargeStrength, linkStrokeWidth
        });
        
        // Create force simulation with adjusted parameters (same as working SimpleVisualizationComponent)
        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(linkDistance))
            .force('charge', d3.forceManyBody().strength(chargeStrength))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(nodeRadius + 2));
        
        // Add links to graph container (same as working SimpleVisualizationComponent)
        const link = this.graphContainer.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', nodeCount > 100 ? 0.3 : 0.6)
            .attr('stroke-width', linkStrokeWidth);
        
        console.log('VisualizationComponent: Created links:', link.size());
        
        // Add nodes to graph container (EXACT copy from working SimpleVisualizationComponent)
        const node = this.graphContainer.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', nodeRadius)
            .attr('fill', '#69b3a2')
            .attr('stroke', '#fff')
            .attr('stroke-width', nodeCount > 100 ? 0.5 : 1.5)
            .attr('opacity', nodeCount > 500 ? 0.8 : 1);
        
        console.log('VisualizationComponent: Node elements created:', node.nodes());
        console.log('VisualizationComponent: First node element:', node.node());
        console.log('VisualizationComponent: GraphContainer element:', this.graphContainer.node());
            
        console.log('VisualizationComponent: Created nodes:', node.size());
        
        // Add labels for small graphs only
        let labels = null;
        if (this.options.showLabels && nodes.length <= this.options.maxNodesForLabels) {
            labels = this.graphContainer.append('g')
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
        
        // Add zoom behavior (same as working SimpleVisualizationComponent)
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                this.graphContainer.attr('transform', event.transform);
            });
        
        this.svg.call(zoom);
        
        // Update positions on simulation tick
        let tickCount = 0;
        this.simulation.on('tick', () => {
            tickCount++;
            if (tickCount <= 10) {
                console.log(`VisualizationComponent: Simulation tick ${tickCount}, node positions:`, nodes.slice(0, 2).map(n => ({ id: n.id, x: n.x, y: n.y })));
                console.log(`VisualizationComponent: Tick ${tickCount}, updating ${node.size()} nodes and ${link.size()} links`);
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
                console.log('VisualizationComponent: Stopped simulation for large graph');
            }, 5000);
        }
        
        console.log('VisualizationComponent: Visualization created successfully');
        
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
            edges: [[0, 1], [1, 2], [2, 0], [0, 3], [3, 4], [4, 1]]
        };
        
        console.log('VisualizationComponent: Testing with data:', testData);
        this.visualizeGraph(testData);
    }
    
    // Method to test with the same data that works in SimpleVisualizationComponent
    testWithSimpleData() {
        console.log('=== VisualizationComponent Test with Simple Data ===');
        
        // Generate the same test data as SimpleVisualizationComponent would receive
        const testData = {
            edges: []
        };
        
        // Create a small test graph
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 2; j++) {
                const target = Math.floor(Math.random() * 10);
                if (target !== i) {
                    testData.edges.push([i, target]);
                }
            }
        }
        
        console.log('VisualizationComponent: Testing with generated data:', testData);
        this.visualizeGraph(testData);
    }
}
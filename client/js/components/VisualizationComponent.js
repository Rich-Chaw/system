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
        this.simulation = null;
        this.svg = null;
        this.currentGraphData = null;
        this.removedNodes = new Set();
        
        super.init();
        
        // Listen for graph events
        this.on('graph:loaded', (data) => {
            console.log('VisualizationComponent received graph:loaded event:', data);
            this.visualizeGraph(data.graphData);
        });
        
        this.on('graph:cleared', () => {
            this.clearVisualization();
        });
        
        this.on('dismantling:progress', (data) => {
            this.updateDismantlingVisualization(data);
        });
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
    }
    
    initializeVisualization() {
        const container = this.container.querySelector('#graphViz');
        if (!container) return;
        
        // Clear existing visualization
        container.innerHTML = '';
        
        const width = container.clientWidth || this.options.width;
        const height = this.options.height;
        
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
    }
    
    visualizeGraph(graphData) {
        if (!this.svg || !graphData) return;
        
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
            graphData.edges.forEach(edge => {
                nodeSet.add(edge[0]);
                nodeSet.add(edge[1]);
                links.push({ 
                    source: edge[0], 
                    target: edge[1],
                    id: `${edge[0]}-${edge[1]}`
                });
            });
        }
        
        nodeSet.forEach(nodeId => {
            nodes.push({ 
                id: nodeId,
                removed: false
            });
        });
        
        if (nodes.length === 0) return;
        
        const width = this.svg.attr('width');
        const height = this.svg.attr('height');
        
        // Create force simulation
        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(this.options.linkDistance))
            .force('charge', d3.forceManyBody().strength(this.options.chargeStrength))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(this.options.nodeRadius + 2));
        
        const container = this.svg.select('.graph-container');
        
        // Add links
        const link = container.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);
        
        // Add nodes
        const node = container.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', this.options.nodeRadius)
            .attr('fill', '#69b3a2')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .call(this.createDragBehavior());
        
        // Add labels for small graphs
        let labels = null;
        if (this.options.showLabels && nodes.length <= this.options.maxNodesForLabels) {
            labels = container.append('g')
                .attr('class', 'labels')
                .selectAll('text')
                .data(nodes)
                .enter().append('text')
                .text(d => d.id)
                .attr('font-size', '10px')
                .attr('text-anchor', 'middle')
                .attr('dy', '.35em')
                .attr('pointer-events', 'none');
        }
        
        // Update positions on simulation tick
        this.simulation.on('tick', () => {
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
}
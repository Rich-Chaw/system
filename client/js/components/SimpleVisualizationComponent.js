/**
 * Simple Visualization Component - Minimal version for debugging
 */
class SimpleVisualizationComponent extends BaseComponent {
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
        console.log('SimpleVisualizationComponent.init() called');
        
        this.svg = null;
        
        super.init();
        
        console.log('SimpleVisualizationComponent: Setting up event listener');
        
        // Listen for graph events
        this.on('graph:loaded', (data) => {
            console.log('SimpleVisualizationComponent: Received graph:loaded event');
            this.createSimpleVisualization(data.graphData);
        });
        
        // Advanced event listeners
        this.on('graph:cleared', () => {
            this.clearVisualization();
        });
        
        this.on('dismantling:progress', (data) => {
            this.updateDismantlingVisualization(data);
        });
        
        console.log('SimpleVisualizationComponent: Initialization complete');
    }
    
    render() {
        console.log('SimpleVisualizationComponent.render() called');
        this.initializeSVG();
    }
    
    initializeSVG() {
        console.log('SimpleVisualizationComponent: Initializing SVG');
        
        const container = this.container.querySelector('#graphViz');
        console.log('SimpleVisualizationComponent: Found container:', !!container);
        
        if (!container) {
            console.error('SimpleVisualizationComponent: No #graphViz container found');
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        // Create SVG
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', this.options.width)
            .attr('height', this.options.height)
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
        
        // Create container for graph elements (same as working MultiView)
        this.graphContainer = this.svg.append('g')
            .attr('class', 'graph-container');
        
        console.log('SimpleVisualizationComponent: SVG created successfully');
    }
    
    createSimpleVisualization(graphData) {
        console.log('SimpleVisualizationComponent: Creating visualization with data:', graphData);
        
        if (!this.svg) {
            console.log('SimpleVisualizationComponent: SVG not ready, initializing...');
            this.initializeSVG();
        }
        
        if (!this.svg || !graphData || !graphData.edges) {
            console.error('SimpleVisualizationComponent: Cannot create visualization', {
                svg: !!this.svg,
                graphData: !!graphData,
                edges: graphData ? !!graphData.edges : false
            });
            return;
        }
        
        // Clear previous visualization but keep test elements
        if (this.graphContainer) {
            this.graphContainer.selectAll('*').remove();
        } else {
            this.graphContainer = this.svg.append('g').attr('class', 'graph-container');
        }
        
        // Create simple node and link data (same as working MultiView)
        const nodes = [];
        const links = [];
        const nodeSet = new Set();
        
        // Handle both formats: [source, target] and {source, target}
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
        
        nodeSet.forEach(nodeId => {
            nodes.push({ id: nodeId });
        });
        
        console.log('SimpleVisualizationComponent: Prepared data', { nodes: nodes.length, links: links.length });
        
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
        
        console.log('SimpleVisualizationComponent: Using parameters for', nodeCount, 'nodes:', {
            nodeRadius, linkDistance, chargeStrength, linkStrokeWidth
        });
        
        // Create force simulation with adjusted parameters (same as working MultiView)
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(linkDistance))
            .force('charge', d3.forceManyBody().strength(chargeStrength))
            .force('center', d3.forceCenter(this.options.width / 2, this.options.height / 2))
            .force('collision', d3.forceCollide().radius(nodeRadius + 2));
        
        // Add links to graph container (same as working MultiView)
        const link = this.graphContainer.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', nodeCount > 100 ? 0.3 : 0.6)
            .attr('stroke-width', linkStrokeWidth);
        
        // Add nodes to graph container (same as working MultiView)
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
            .attr('opacity', nodeCount > 500 ? 0.8 : 1)
            .call(this.createDragBehavior());
        
        // Add labels for small graphs
        let labels = null;
        if (nodes.length <= 50) {
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
        
        // Add zoom behavior (same as working MultiView)
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                this.graphContainer.attr('transform', event.transform);
            });
        
        this.svg.call(zoom);
        
        // Update positions on tick
        simulation.on('tick', () => {
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
                simulation.alpha(0);
                console.log('SimpleVisualizationComponent: Stopped simulation for large graph');
            }, 5000);
        }
        
        // Store references for advanced features
        this.simulation = simulation;
        this.nodes = nodes;
        this.links = links;
        this.nodeSelection = node;
        this.linkSelection = link;
        this.labelSelection = labels;
        this.removedNodes = new Set();
        
        console.log('SimpleVisualizationComponent: Visualization created successfully');
    }
    
    createDragBehavior() {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active && this.simulation) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active && this.simulation) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }
    
    // Advanced feature: Update dismantling visualization
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
    
    // Advanced feature: Clear visualization
    clearVisualization() {
        if (this.svg) {
            this.graphContainer.selectAll('*').remove();
        }
        
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
        
        this.removedNodes.clear();
        this.nodes = null;
        this.links = null;
        this.nodeSelection = null;
        this.linkSelection = null;
        this.labelSelection = null;
        
        this.emit('visualization:cleared');
    }
    
    // Advanced feature: Highlight specific nodes
    highlightNodes(nodeIds, className = 'highlighted') {
        if (!this.nodeSelection) return;
        
        this.nodeSelection
            .classed(className, d => nodeIds.includes(d.id));
    }
    
    // Advanced feature: Reset all highlights
    resetHighlights() {
        if (!this.nodeSelection) return;
        
        this.nodeSelection
            .attr('class', 'node')
            .classed('removed', d => this.removedNodes.has(d.id));
    }
    
    // Advanced feature: Get current visualization state
    getVisualizationState() {
        return {
            hasGraph: !!this.nodes,
            nodeCount: this.nodes ? this.nodes.length : 0,
            linkCount: this.links ? this.links.length : 0,
            removedCount: this.removedNodes.size
        };
    }
}
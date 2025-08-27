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
            chargeStrength: -100
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
            .attr('opacity', nodeCount > 500 ? 0.8 : 1);
        
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
        });
        
        // For large graphs, stop simulation after a reasonable time
        if (nodeCount > 100) {
            setTimeout(() => {
                simulation.alpha(0);
                console.log('SimpleVisualizationComponent: Stopped simulation for large graph');
            }, 5000);
        }
        
        console.log('SimpleVisualizationComponent: Visualization created successfully');
    }
}
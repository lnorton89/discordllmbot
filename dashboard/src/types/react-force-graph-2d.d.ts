/**
 * Type declarations for react-force-graph-2d
 */

declare module 'react-force-graph-2d' {
  import { FC, RefObject } from 'react';

  interface GraphNode {
    id: number | string;
    x?: number;
    y?: number;
    val?: number;
    color?: string;
    [key: string]: unknown;
  }

  interface GraphLink {
    source: number | string | GraphNode;
    target: number | string | GraphNode;
    value?: number;
    [key: string]: unknown;
  }

  interface ForceGraphMethods {
    centerAt(x?: number, y?: number, durationMs?: number): this;
    zoom(zoom?: number, durationMs?: number): this;
    zoomToFit(durationMs?: number, padding?: number, nodeFilter?: (node: GraphNode) => boolean): this;
    pauseAnimation(): this;
    resumeAnimation(): this;
    width(): number;
    width(width: number): this;
    height(): number;
    height(height: number): this;
    graphData(): { nodes: GraphNode[]; links: GraphLink[] };
    graphData(data: { nodes: GraphNode[]; links: GraphLink[] }): this;
    onNodeClick(callback: (node: GraphNode, event: MouseEvent) => void): this;
    onNodeDrag(callback: (node: GraphNode) => void): this;
    onNodeDragEnd(callback: (node: GraphNode) => void): this;
    onBackgroundClick(callback: (event: MouseEvent) => void): this;
    onEngineStop(callback: () => void): this;
  }

  interface ForceGraphProps {
    width?: number;
    height?: number;
    graphData?: { nodes: GraphNode[]; links: GraphLink[] };
    nodeLabel?: string | ((node: GraphNode) => string);
    nodeColor?: string | ((node: GraphNode) => string);
    nodeVal?: string | ((node: GraphNode) => number);
    nodeRelSize?: number;
    nodeCanvasObject?: (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    nodeCanvasObjectMode?: string | ((node: GraphNode) => string);
    linkLabel?: string | ((link: GraphLink) => string);
    linkColor?: string | ((link: GraphLink) => string);
    linkWidth?: string | number | ((link: GraphLink) => number);
    linkDirectionalArrowLength?: number | ((link: GraphLink) => number);
    linkDirectionalArrowColor?: string | ((link: GraphLink) => string);
    linkDirectionalArrowRelPos?: number | ((link: GraphLink) => number);
    linkCurvature?: number | ((link: GraphLink) => number);
    linkDirectionalParticles?: number | ((link: GraphLink) => number);
    linkDirectionalParticleSpeed?: number | ((link: GraphLink) => number);
    linkDirectionalParticleColor?: string | ((link: GraphLink) => string);
    linkDirectionalParticleWidth?: number | ((link: GraphLink) => number);
    backgroundColor?: string;
    onNodeClick?: (node: GraphNode) => void;
    onNodeDrag?: (node: GraphNode) => void;
    onNodeDragEnd?: (node: GraphNode) => void;
    onNodeHover?: (node: GraphNode | null) => void;
    onLinkHover?: (link: GraphLink | null) => void;
    onBackgroundClick?: (event: MouseEvent) => void;
    onEngineStop?: () => void;
    cooldownTicks?: number;
    warmupTicks?: number;
    d3VelocityDecay?: number;
    d3AlphaDecay?: number;
    d3AlphaMin?: number;
    pauseAnimation?: () => void;
    resumeAnimation?: () => void;
    centerAt?: (x?: number, y?: number, durationMs?: number) => void;
    zoom?: (zoom?: number, durationMs?: number) => void;
    zoomToFit?: (durationMs?: number, padding?: number, nodeFilter?: (node: GraphNode) => boolean) => void;
    getGraphBbox?: () => { x: [number, number]; y: [number, number] };
    ref?: RefObject<ForceGraphMethods>;
  }

  const ForceGraph2D: FC<ForceGraphProps>;
  export default ForceGraph2D;
  export { ForceGraphMethods, ForceGraphProps };
}

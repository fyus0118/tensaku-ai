"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface GraphNode {
  id: string;
  topic: string;
  subject: string;
  effectiveConfidence: number;
  retention: number;
  retentionStatus: string;
  depth: number;
  isCollapsing: boolean;
  isCascadeRoot: boolean;
  casualtyCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  strength: number;
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Retention status -> color mapping
function getNodeColor(node: GraphNode): string {
  if (node.isCascadeRoot) return "#dc2626"; // red-600
  if (node.isCollapsing) return "#f97316"; // orange-500
  if (node.retentionStatus === "forgotten") return "#ef4444"; // red-500
  if (node.retentionStatus === "stale") return "#f59e0b"; // amber-500
  if (node.retentionStatus === "fading") return "#eab308"; // yellow-500
  return "#10b981"; // emerald-500
}

function getNodeBorder(node: GraphNode): string {
  if (node.isCascadeRoot) return "3px solid #991b1b";
  if (node.isCollapsing) return "2px solid #c2410c";
  return "1px solid #e5e7eb";
}

// Custom node component
function KnowledgeNode({ data }: NodeProps) {
  const node = data as unknown as GraphNode;
  const color = getNodeColor(node);
  const border = getNodeBorder(node);
  const size = Math.max(36, Math.min(60, 36 + node.depth * 4));

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          border,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          boxShadow: node.isCascadeRoot
            ? "0 0 12px rgba(220, 38, 38, 0.5)"
            : node.isCollapsing
            ? "0 0 8px rgba(249, 115, 22, 0.4)"
            : "0 1px 3px rgba(0,0,0,0.1)",
          transition: "all 0.3s ease",
        }}
        title={`${node.topic}\nEC: ${node.effectiveConfidence}% | 記憶: ${node.retention}%${
          node.isCascadeRoot ? `\n⚠️ 崩壊起点: ${node.casualtyCount}個巻き添え` : ""
        }${node.isCollapsing ? "\n⚠️ 崩壊リスク" : ""}`}
      >
        <span
          style={{
            fontSize: size > 44 ? "8px" : "7px",
            color: "#fff",
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.1,
            maxWidth: size - 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.topic.length > 6 ? node.topic.slice(0, 5) + "…" : node.topic}
        </span>

        {/* EC indicator */}
        <div
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: node.effectiveConfidence > 70 ? "#059669" : node.effectiveConfidence > 40 ? "#d97706" : "#dc2626",
            border: "2px solid white",
            fontSize: "6px",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
          }}
        >
          {node.effectiveConfidence}
        </div>

        {/* Cascade root warning */}
        {node.isCascadeRoot && (
          <div
            style={{
              position: "absolute",
              top: -8,
              left: -8,
              fontSize: "12px",
            }}
          >
            ⚠️
          </div>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          top: size + 4,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "9px",
          color: "#6b7280",
          whiteSpace: "nowrap",
          maxWidth: 80,
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "center",
        }}
      >
        {node.topic}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
    </>
  );
}

const nodeTypes = { knowledge: KnowledgeNode };

// Edge style based on type
function getEdgeStyle(type: string, strength: number) {
  const opacity = 0.3 + strength * 0.7;
  switch (type) {
    case "depends_on":
      return { stroke: "#6366f1", strokeWidth: 2, opacity }; // indigo
    case "contradicts":
      return { stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "5 5", opacity }; // red dashed
    case "example_of":
      return { stroke: "#8b5cf6", strokeWidth: 1, opacity }; // purple
    default:
      return { stroke: "#9ca3af", strokeWidth: 1, opacity }; // gray
  }
}

export default function KnowledgeGraph({ nodes: graphNodes, edges: graphEdges }: KnowledgeGraphProps) {
  // Layout: simple force-directed-like positioning using subject grouping
  const nodes: Node[] = useMemo(() => {
    const subjectGroups = new Map<string, GraphNode[]>();
    for (const node of graphNodes) {
      const list = subjectGroups.get(node.subject) || [];
      list.push(node);
      subjectGroups.set(node.subject, list);
    }

    const result: Node[] = [];
    let groupIdx = 0;
    const groupCount = subjectGroups.size;

    for (const [, groupNodes] of subjectGroups) {
      const angle = (groupIdx / Math.max(groupCount, 1)) * 2 * Math.PI;
      const groupRadius = 200;
      const centerX = 400 + Math.cos(angle) * groupRadius;
      const centerY = 300 + Math.sin(angle) * groupRadius;

      groupNodes.forEach((node, i) => {
        const nodeAngle = (i / Math.max(groupNodes.length, 1)) * 2 * Math.PI;
        const nodeRadius = Math.min(120, 40 + groupNodes.length * 15);

        result.push({
          id: node.id,
          type: "knowledge",
          position: {
            x: centerX + Math.cos(nodeAngle) * nodeRadius,
            y: centerY + Math.sin(nodeAngle) * nodeRadius,
          },
          data: node as unknown as Record<string, unknown>,
        });
      });
      groupIdx++;
    }

    return result;
  }, [graphNodes]);

  const edges: Edge[] = useMemo(() => {
    return graphEdges.map((e, i) => {
      const style = getEdgeStyle(e.type, e.strength);
      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        style,
        animated: e.type === "depends_on",
        label: e.type === "depends_on" ? "依存" : e.type === "contradicts" ? "矛盾" : undefined,
        labelStyle: { fontSize: 8, fill: "#9ca3af" },
      };
    });
  }, [graphEdges]);

  const onInit = useCallback(() => {}, []);

  if (graphNodes.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center text-sm text-[var(--color-text-muted)]">
        知識を蓄積すると、ここに依存グラフが表示されます
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
      <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--color-text)]">知識の依存グラフ</h3>
        <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 健全
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> 薄れている
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> 崩壊リスク
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-600 ring-2 ring-red-300" /> 崩壊起点
          </span>
        </div>
      </div>
      <div style={{ height: 500 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#f3f4f6" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

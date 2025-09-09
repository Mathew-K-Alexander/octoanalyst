import { useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export function toGraph(data, companyName = "Company") {
  const topics = Object.keys(data);
  if (topics.length == 0) {
    return { nodes: [], edges: [] };
  }
  const angleStep = (2 * Math.PI) / topics.length;
  const radius = 250;

  // root node (company)
  const rootNode = {
    id: "root",
    position: { x: 500, y: 300 },
    data: { label: companyName, summary: "" },
    style: {
      width: 220,
      padding: 8,
      borderRadius: 12,
      border: "1px solid #ddd",
      background: "#fff",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
  };

  const nodes = topics.map((topic, i) => {
    const angle = i * angleStep;
    const x = rootNode.position.x + radius * Math.cos(angle);
    const y = rootNode.position.y + radius * Math.sin(angle);

    return {
      id: `t-${i}`,
      position: { x, y },
      data: {
        label: topic,
        summary: data[topic] || "",
      },
      style: {
        width: 200,
        padding: 8,
        borderRadius: 12,
        border: "1px solid #ddd",
        background: "#fafafa",
        fontSize: 13,
        textAlign: "center",
      },
    };
  });

  // edges root → topics
  const edges = topics.map((_, i) => ({
    id: `e-root-${i}`,
    source: "root",
    target: `t-${i}`,
  }));

  return { nodes: [rootNode, ...nodes], edges };
}

export function Canvas({ selected, mapcontent, onSelectNode }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    const { nodes, edges } = toGraph(mapcontent, selected);
    setNodes(nodes);
    setEdges(edges);
  }, [mapcontent]);

  const onNodesChange = useCallback(
    (changes) => setNodes((ns) => applyNodeChanges(changes, ns)),
    []
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((es) => applyEdgeChanges(changes, es)),
    []
  );
  const onConnect = useCallback(
    (params) => setEdges((es) => addEdge(params, es)),
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      // ONLY react to node clicks; parent handles root-ignore & state update
      onNodeClick={(evt, node) => {
        if (node?.id === "root") return;
        onSelectNode?.(node);
      }}
      fitView
    />
  );
}

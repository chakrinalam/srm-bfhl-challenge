const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Your credentials (REPLACE WITH YOUR ACTUAL DETAILS)
const USER_ID = "john_doe_15042000"; // Change to your fullname_ddmmyyyy
const EMAIL_ID = "john.doe@university.edu"; // Your college email
const COLLEGE_ROLL_NUMBER = "21CS1001"; // Your roll number

// Helper function to validate node format
function isValidNode(node) {
    const trimmed = node.trim();
    const regex = /^[A-Z]->[A-Z]$/;
    return regex.test(trimmed) && trimmed.split('->')[0] !== trimmed.split('->')[1];
}

// Helper function to parse node
function parseNode(node) {
    const trimmed = node.trim();
    const [parent, child] = trimmed.split('->');
    return { parent, child };
}

// Build tree structure
function buildTree(edges) {
    const children = new Map();
    const parents = new Map();
    const allNodes = new Set();

    // First pass: build relationships
    for (const [parent, child] of edges) {
        allNodes.add(parent);
        allNodes.add(child);

        if (!children.has(parent)) {
            children.set(parent, []);
        }
        children.get(parent).push(child);

        parents.set(child, (parents.get(child) || 0) + 1);
    }

    // Find roots
    const roots = [];
    for (const node of allNodes) {
        if (!parents.has(node)) {
            roots.push(node);
        }
    }

    // If no root (pure cycle), use lexicographically smallest node
    if (roots.length === 0 && allNodes.size > 0) {
        roots.push([...allNodes].sort()[0]);
    }

    // Build nested tree object
    function buildNestedTree(root, visited = new Set()) {
        if (visited.has(root)) return {};
        visited.add(root);

        const nodeChildren = children.get(root) || [];
        const result = {};

        for (const child of nodeChildren) {
            result[child] = buildNestedTree(child, visited);
            if (Object.keys(result[child]).length === 0 && child !== undefined) {
                result[child] = {};
            }
        }
        return result;
    }

    // Calculate depth
    function getDepth(node, visited = new Set()) {
        if (visited.has(node)) return 0;
        visited.add(node);

        const nodeChildren = children.get(node) || [];
        if (nodeChildren.length === 0) return 1;

        let maxDepth = 0;
        for (const child of nodeChildren) {
            maxDepth = Math.max(maxDepth, getDepth(child, new Set(visited)));
        }
        return maxDepth + 1;
    }

    // Detect cycle in a group starting from root
    function hasCycle(root) {
        const visited = new Set();
        const stack = new Set();

        function dfs(node) {
            if (stack.has(node)) return true;
            if (visited.has(node)) return false;

            visited.add(node);
            stack.add(node);

            const nodeChildren = children.get(node) || [];
            for (const child of nodeChildren) {
                if (dfs(child)) return true;
            }

            stack.delete(node);
            return false;
        }

        return dfs(root);
    }

    // Group nodes by connected component
    const visitedGlobal = new Set();
    const components = [];

    for (const node of allNodes) {
        if (!visitedGlobal.has(node)) {
            const queue = [node];
            const component = new Set();

            while (queue.length > 0) {
                const current = queue.shift();
                if (component.has(current)) continue;
                component.add(current);
                visitedGlobal.add(current);

                const nodeChildren = children.get(current) || [];
                for (const child of nodeChildren) {
                    if (!component.has(child)) queue.push(child);
                }

                for (const [parent, child] of edges) {
                    if (child === current && !component.has(parent)) {
                        queue.push(parent);
                    }
                }
            }
            components.push(component);
        }
    }

    // Process each component
    const hierarchies = [];

    for (const component of components) {
        const componentNodes = [...component];
        const componentRoots = componentNodes.filter(n => !parents.has(n));
        let actualRoot = componentRoots.length > 0 ? componentRoots.sort()[0] : componentNodes.sort()[0];

        // Check if this component has a cycle
        const cycle = hasCycle(actualRoot);

        if (cycle) {
            hierarchies.push({
                root: actualRoot,
                tree: {},
                has_cycle: true
            });
        } else {
            const tree = {};
            tree[actualRoot] = buildNestedTree(actualRoot);
            const depth = getDepth(actualRoot);

            hierarchies.push({
                root: actualRoot,
                tree: tree,
                depth: depth
            });
        }
    }

    return hierarchies;
}

// Main API endpoint
app.post('/bfhl', (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ error: "Invalid request: data array required" });
        }

        const validEdges = [];
        const invalidEntries = [];
        const duplicateEdges = [];
        const seenEdges = new Set();

        // Process each entry
        for (const entry of data) {
            if (typeof entry !== 'string') {
                invalidEntries.push(String(entry));
                continue;
            }

            if (isValidNode(entry)) {
                const { parent, child } = parseNode(entry);
                const edgeKey = `${parent}->${child}`;

                if (seenEdges.has(edgeKey)) {
                    if (!duplicateEdges.includes(edgeKey)) {
                        duplicateEdges.push(edgeKey);
                    }
                } else {
                    seenEdges.add(edgeKey);
                    validEdges.push([parent, child]);
                }
            } else {
                invalidEntries.push(entry);
            }
        }

        // Build hierarchies
        const hierarchies = buildTree(validEdges);

        // Calculate summary
        const validTrees = hierarchies.filter(h => !h.has_cycle);
        const totalTrees = validTrees.length;
        const totalCycles = hierarchies.length - totalTrees;

        let largestTreeRoot = null;
        let maxDepth = -1;

        for (const tree of validTrees) {
            if (tree.depth > maxDepth) {
                maxDepth = tree.depth;
                largestTreeRoot = tree.root;
            } else if (tree.depth === maxDepth && largestTreeRoot && tree.root < largestTreeRoot) {
                largestTreeRoot = tree.root;
            }
        }

        // Response
        const response = {
            user_id: USER_ID,
            email_id: EMAIL_ID,
            college_roll_number: COLLEGE_ROLL_NUMBER,
            hierarchies: hierarchies,
            invalid_entries: invalidEntries,
            duplicate_edges: duplicateEdges,
            summary: {
                total_trees: totalTrees,
                total_cycles: totalCycles,
                largest_tree_root: largestTreeRoot || ""
            }
        };

        res.json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
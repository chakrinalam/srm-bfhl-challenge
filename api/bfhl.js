export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Only POST allowed" });
    }

    const data = req.body.data || [];

    let validEdges = [];
    let invalid_entries = [];
    let duplicate_edges = [];

    let seenEdges = new Set();
    let childParent = {};

    // STEP 1: VALIDATION
    data.forEach(item => {
        item = item.trim();

        if (!/^[A-Z]->[A-Z]$/.test(item) || item[0] === item[3]) {
            invalid_entries.push(item);
            return;
        }

        if (seenEdges.has(item)) {
            if (!duplicate_edges.includes(item)) {
                duplicate_edges.push(item);
            }
            return;
        }

        let parent = item[0];
        let child = item[3];

        // multi-parent case
        if (childParent[child]) return;

        childParent[child] = parent;

        seenEdges.add(item);
        validEdges.push([parent, child]);
    });

    // STEP 2: BUILD GRAPH
    let graph = {};
    let nodes = new Set();

    validEdges.forEach(([p, c]) => {
        if (!graph[p]) graph[p] = [];
        graph[p].push(c);

        nodes.add(p);
        nodes.add(c);
    });

    // STEP 3: FIND ROOTS
    let children = new Set(Object.keys(childParent));
    let roots = [...nodes].filter(n => !children.has(n));

    if (roots.length === 0 && nodes.size > 0) {
        roots = [Array.from(nodes).sort()[0]];
    }

    let hierarchies = [];
    let total_trees = 0;
    let total_cycles = 0;
    let maxDepth = 0;
    let largest_tree_root = "";

    function dfs(node, path) {
        if (path.has(node)) return { cycle: true };

        path.add(node);

        let obj = {};
        let depth = 1;

        if (graph[node]) {
            for (let child of graph[node]) {
                let res = dfs(child, new Set(path));

                if (res.cycle) return { cycle: true };

                obj[child] = res.tree;
                depth = Math.max(depth, 1 + res.depth);
            }
        }

        return { tree: obj, depth };
    }

    // STEP 4: BUILD TREES
    roots.forEach(root => {
        let res = dfs(root, new Set());

        if (res.cycle) {
            hierarchies.push({
                root,
                tree: {},
                has_cycle: true
            });
            total_cycles++;
        } else {
            hierarchies.push({
                root,
                tree: { [root]: res.tree },
                depth: res.depth
            });

            total_trees++;

            if (
                res.depth > maxDepth ||
                (res.depth === maxDepth && root < largest_tree_root)
            ) {
                maxDepth = res.depth;
                largest_tree_root = root;
            }
        }
    });

    res.status(200).json({
        user_id: "chakradhar_13032006",
        email_id: "cn7827@srmist.edu.in",
        college_roll_number: "RA2311028010088",
        hierarchies,
        invalid_entries,
        duplicate_edges,
        summary: {
            total_trees,
            total_cycles,
            largest_tree_root
        }
    });
}
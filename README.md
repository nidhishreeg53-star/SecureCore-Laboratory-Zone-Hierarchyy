# Nidhi_Module4_CPP — SecureCore (C++ engine + website)

Module 04 (Tree Data Structure). The tree, DFS, BFS, preorder, postorder, level-order and
permission check are written in **C++** (`src/securecore.cpp`). The website in `web/` shows them.
It is an educational simulation: no real doors, identities or security.

## Why WebAssembly?
GitHub Pages only serves static files and cannot run C++. So GitHub Actions compiles the same
C++ file to WebAssembly (`securecore.wasm`) with Emscripten, and the page calls it.

## Folder layout
```
src/securecore.cpp                C++ engine + console program
web/index.html, style.css, script.js   the website (calls the C++ functions)
.github/workflows/deploy.yml      builds C++ (native + WebAssembly) and deploys the site
```

## Deploy on GitHub (no installation needed)
1. Create a repository named `Nidhi_Module4_CPP` and upload everything in this folder, keeping the folders (including the hidden `.github` folder).
2. Open **Settings → Pages**. Under Build and deployment, set **Source** to **GitHub Actions**.
3. Open the **Actions** tab. The workflow runs on every push to `main`; wait for the green tick.
4. Your site: `https://YOUR-GITHUB-USERNAME.github.io/Nidhi_Module4_CPP/` (replace with your username).
   The "native" job's log also shows the C++ console output.

The site is not live until the workflow has finished successfully.

## Run the C++ program on your computer
```
g++ -std=c++17 -O2 -o securecore src/securecore.cpp
./securecore                          # full demo
./securecore search dfs "Cold Storage"
./securecore search bfs "Cold Storage"
./securecore check R101 "Lab A"
```

## Build the website on your computer (optional)
Install Emscripten (emsdk), then from this folder:
```
emcc src/securecore.cpp -std=c++17 -O2 -o web/securecore.js -sMODULARIZE=1 -sEXPORT_NAME=SecureCoreModule -sENVIRONMENT=web -sEXPORTED_FUNCTIONS=_sc_tree_json,_sc_permissions_json,_sc_traverse,_sc_search,_sc_decide -sEXPORTED_RUNTIME_METHODS=ccall
cd web && python3 -m http.server 8000
```
Open http://localhost:8000 (WebAssembly does not load from a double-clicked file).

## Algorithms
| Function | Idea | Time |
|---|---|---|
| `preorder` / `postorder` | recursion: node before / after its children | O(n) |
| `levelorder`, `bfsSearch` | queue, level by level | O(n) |
| `dfsSearch` | recursion, deep first | O(n) worst case |
| `decide` | looks the researcher up in the separate `staff` map | O(zones) |

## Limitations
- A tree models structure; it cannot prove identity or grant permission.
- General-tree search may examine every node. A BST gives O(log n) only when balanced; ascending inserts make it O(n).
- Sorting with a BST (in-order) averages O(n log n) but degrades to O(n²) on already-sorted input.
- Permissions shipped to a browser can be inspected and edited. Real access control needs identity verification, explicit policies, server-side enforcement and audit logs.

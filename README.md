# PetriSlim — Petri Net Reduction & Reachability Analysis

**PetriSlim** is an interactive web application built with **React**, **Vite**, and **Tailwind CSS** designed to model, analyze, and optimize **Petri Nets** (*Réseaux de Petri*). It addresses the **combinatorial state explosion problem** (*explosion combinatoire des états*) by applying structural reduction techniques while preserving the behavioral properties of the modeled system.

> **Academic Context:** Developed as a mini-project for the **SVS** (*Spécification et Vérification des Systèmes*) module — Master 2 ILSI, Department of TLSI, Faculty of NTIC, **Université Constantine 2 - Abdelhamid Mehri**.

## Features

### 1. Dual Petri Net Modeling (Graphical & Matrix Modes)

* **Interactive Graph Canvas:** Create and manipulate Places ($P$), Transitions ($T$), directed Arcs, arc weights, and initial tokens ($M_0$) visually.

* **Synchronized Matrix Editor:** Define or edit the network directly using the **Pre-incidence (**$Pre$**)**, **Post-incidence (**$Post$**)**, and **Initial Marking (**$M_0$**)** matrices, kept in real-time sync with the visual graph.

### 2. Reachability Graph Generator (*Graphe des Marquages Accessibles*)

* Computes the complete state space starting from the initial marking $M_0$ using Breadth-First Search (BFS).

* Evaluates enabled transitions ($\forall p \in P,\; M(p) \ge Pre(p, t)$) and calculates successor markings ($M' = M - Pre(\cdot, t) + Post(\cdot, t)$).

* Visually compares the state space size before and after reduction to demonstrate state-space optimization.

### 3. Structural Reduction Engine (6 Techniques)

Supports both **step-by-step execution** (with rule logs) and **automatic full reduction** until convergence:

| \# | Technique | Description | 
| ----- | ----- | ----- | 
| **1** | **Substitutable Place** (*Place Substituable*) | Eliminates an intermediate place $p_1$ between two sequential transitions $t_1$ and $t_2$, merging them into $t_{12}$. | 
| **2** | **Identical Places** (*Places Identiques*) | Removes duplicate parallel places sharing identical input/output transitions, arc weights, and initial markings. | 
| **3** | **Identity Transition** (*Transition Identité*) | Removes neutral transitions connected strictly via self-loops whose firing leaves the system state unchanged. | 
| **4** | **Identical Transitions** (*Transitions Identiques*) | Eliminates duplicate parallel transitions that share identical pre- and post-conditions. | 
| **5** | **Fusion of Series Places** (*Fusion de Places en Série*) | Merges two sequential places $p_1 \to t_1 \to p_2$ connected by a strict intermediate transition into a single place $p_{12}$. | 
| **6** | **Identity Place** (*Place Identité*) | Removes self-looped places attached to a transition that do not alter or restrict system behavior. | 

### 4. PetriSlim JSON Projects

* Create a new empty net, open a PetriSlim `.json` project, or download the current net as JSON.
* Project files preserve places, transitions, initial tokens, arc weights, node positions, and arc curves.
* Invalid or unsupported project versions are rejected with an error; built-in presets remain available.

## Tech Stack

* **Frontend Framework:** React.js (with Vite)

* **Styling:** Tailwind CSS

* **Graph Visualization:** Cytoscape.js

* **Icons:** Lucide React

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher)

* `npm` or `yarn`

### Installation

1. **Clone the repository:**

   ```
   git clone https://github.com/Nadjibochacha/PetriSlim.git
   cd petrislim
   
   ```

2. **Install dependencies:**

   ```
   npm install
   
   ```

3. **Start the development server:**

   ```
   npm run dev
   
   ```

4. Open your browser and navigate to `http://localhost:5173`.

## Project Structure

```
petrislim/
├── public/                 # Static assets
├── src/
│   ├── components/         # UI components (GraphCanvas, MatrixEditor, ReachabilityView, Toolbar)
│   ├── core/
│   │   ├── reachability.js # BFS state-space & reachability graph generator
│   │   ├── reductions.js   # Implementation of the 6 Petri Net reduction rules
│   │   └── converters.js   # Graph <-> Matrix synchronization utilities
│   ├── presets/            # Built-in sample Petri Nets for testing & demos
│   ├── App.jsx             # Main layout and state orchestration
│   └── main.jsx            # Application entry point
├── package.json
└── README.md

```

## Usage Workflow

1. **Create or Open a Net:** Use the **File** menu to create a blank net or open a PetriSlim JSON project. Built-in presets are also available.

2. **Build a Net:** Draw places, transitions, and arcs on the canvas, or switch to the **Matrix View** to input $Pre$, $Post$, and $M_0$ directly.

3. **Save a Net:** Use **File → Save JSON** to download the current project.

4. **Analyze States:** Click **Generate Reachability Graph** to inspect all reachable markings from $M_0$.

5. **Apply Reductions:** Use **Step Reduce** to observe individual reduction rules in action, or **Reduce All** to simplify the model completely.

6. **Compare Results:** Re-generate the reachability graph on the reduced net to compare the number of states, places, and transitions.

## License

This project is open-source and available under the [MIT License](LICENSE).
# nopamine 智商税检测器

## Overview

Nopamine is a tool for detecting and analyzing "stupid tax", designed to help users identify and avoid unnecessary expenses.

Nopamine 是一个用于检测和分析智商税的工具，旨在帮助用户识别和避免不必要的支出。

## Implementation

- Python backend
- Docker for local deployment
- OpenAI embedding model for text embedding
- Local vector database (e.g., ChromaDB) for knowledge base storage
- React + TailwindCSS frontend for user interaction
- PostgreSQL for user data storage

## RAG

Nopamine uses Retrieval-Augmented Generation (RAG) to provide personalized feedback on users' spending habits. By consulting a local knowledge base, Nopamine can offer insights into the psychological and environmental factors that may influence irrational spending.

## User flow

1. User runs Nopamine in local docker environment and inputs their API keys.
2. User first answer a quiz to define their defnition of irrational spending.
3. User inputs their next planned purcahse and Nopamine evaluates if it is irrational based on their quiz answers.
4. Nopamine provides feedback and suggestions to 1) identify if this purhcase is irrational or rational, 2) explain rationale behind the identification, 3) explain the possible latent reasons (e.g., emotional, cognitive, and environmental influences) behind this planned purchase after consulting local RAG, 4) generate suggestion if irrational.

## Directory structure

This system implements a Dual-Process Cognitive Architecture:
- System 1 (Heuristic/Affective): Handled by the `Psychologist Agent` using RAG to identify emotional triggers and biases.
- System 2 (Analytic/Deliberative): Handled by the `Decision Agent` to evaluate economic utility.
- Synthesis: A final arbitration layer that resolves conflicts between the two systems.

The codebase follows a Functional Core, Imperative Shell pattern. Business logic is pure and isolated in `agents.py` and `rag.py`, while side effects (API calls, DB saves) are pushed to `main.py` and `database.py`.

### Backend taxonomy (`/backend/app`)

#### 1. `database.py`

Responsibility: Manages the persistent state of the application (SQL).
Constraint: Must leverage `sqlalchemy` ORM.
- `get_db() -> Generator`
    - Purpose: Dependency injection provider. Creates a thread-safe database session and guarantees closure after the request logic completes (even if errors occur).
- `init_db() -> None`
    - Purpose: Idempotent initialization. Checks for existence of tables and creates them if missing.

#### 2. `models.py`

Responsibility: Defines the Data Transfer Objects (DTOs) and Database Schema.
Constraint: Strict separation between Pydantic models (API validation) and SQLAlchemy models (DB storage).
- Pydantic Schemas:
    - `QuizSubmission`: Input data validation for the user's definition of irrationality.
    - `PurchaseQuery`: Input data for the specific item the user wants to buy.
    - `AnalysisReport`: The structured output containing the final verdict, reasoning, and psychological citation.
- SQL Tables:
    - `User`: Primary key and metadata.
    - `PsychographicProfile`: Stores the summarized "Constitution" derived from the quiz (e.g., "User is risk-averse but susceptible to scarcity tactics").

#### 3. `rag.py`

Responsibility: The interface to the Vector Knowledge Base.
Constraint: All embedding and vector math are encapsulated here. No other file should know about "cosine similarity."
- `get_vector_store() -> Chroma`
    - Purpose: Singleton provider for the ChromaDB client. Prevents re-initializing the connection on every request.
- `ingest_knowledge_base(directory_path: str) -> int`
    - Purpose: Batch processor. Reads `.txt`/`.pdf` files, chunks them (token-aware), embeds them via OpenAI, and upserts to ChromaDB. Returns count of chunks ingested.
- `retrieve_context(query: str, k: int = 3) -> str`
    - Purpose: Semantic Search. Converts a query (e.g., "impulsive buying late at night") into a vector, finds nearest neighbors in the knowledge base, and returns a concatenated string of context.

#### 4. `prompts.py`

Responsibility: Stores System Prompts and Chain-of-Thought (CoT) templates.
Constraint: No logic functions. Only string constants. This allows non-coders (or prompt engineers) to iterate on the AI's "personality" without touching code.
- `PROFILER_SYSTEM_PROMPT`: Instructions for converting raw quiz answers into a behavioral phenotype.
- `PSYCHOLOGIST_SYSTEM_PROMPT`: Instructions for detecting cognitive biases (e.g., Diderot Effect, Anchoring) using RAG context.
- `DECISION_SYSTEM_PROMPT`: Instructions for evaluating purely financial utility (Affordability vs. Necessity).
- `SYNTHESIS_SYSTEM_PROMPT`: Instructions for resolving cognitive dissonance between the Psychologist and Decision agents.

#### 5. `agents.py`

Responsibility: The "Cognitive Engine." Implements the LangGraph workflow.

Constraint: Each function represents a distinct node in the graph.

- `node_profiler(state: AgentState) -> AgentState`
    - Purpose: Compiles raw quiz data into a `PsychographicProfile`. Only runs once per user or when the profile is updated.
- `node_psychologist(state: AgentState) -> AgentState`
    - Purpose: The "Affective" evaluator.
    - Logic:
        1. Call rag.retrieve_context(state.item_name).
        2. Inject retrieved context + `state.user_profile` into LLM.
        3. Output: Identification of psychological triggers.
- `node_decision_maker(state: AgentState) -> AgentState`
    - Purpose: The "Rational" evaluator.
    - Logic: compares item price vs. user income/budget constraints defined in profile.
- `node_synthesizer(state: AgentState) -> AgentState`
    - Purpose: The Arbiter.
    - Logic: Reads outputs from Psych/Decision nodes. If Logic says "Yes" but Psych says "Impulsive," it generates a warning. If both say "No," it generates a rejection.
- `compile_workflow() -> CompiledGraph`
    - Purpose: Wires the nodes together (Profiler -> Parallel(Psych, Decision) -> Synthesizer) and returns the executable application.

#### 6. `main.py`

Responsibility: The Interface Layer (FastAPI).
Constraint: Zero business logic. It simply accepts requests, calls the Graph, and returns responses.
- `app_lifespan()`
    - Purpose: Context manager to run `database.init_db()` on startup.
- `POST /quiz`
    - Purpose: Receives user answers, runs `node_profiler`, and saves the result to SQLite.
- `POST /consult`
    - Purpose: Receives a purchase plan. Triggers the `agents.workflow`. Returns the `AnalysisReport`.

## Frontend taxonomy (`/frontend/src`)
1. `api/client.js`
    - Responsibility: Abstraction layer for HTTP requests.
    - `submitQuiz(data`): Wrapper for `POST /quiz`.
    - `consultAgent(purchaseQuery)`: Wrapper for `POST /consult`.

2. `pages/Assessment.jsx`
    - Responsibility: Data Collection.
    - Logic: Manages a multi-step form state. On completion, calls `submitQuiz` and redirects to Dashboard.

3. `pages/Dashboard.jsx`
    - Responsibility: Interaction & Result Display.
    - Logic:
        1. Input field for "What do you want to buy?"
        2. Displays "Thinking..." state (while Backend Agents process).
        3. Renders the final `AnalysisReport` using the `MarkdownRenderer`.

4. `components/MarkdownRenderer.jsx`
    - Responsibility: Presentational Safety.
    - Purpose: Safely renders the Markdown returned by the LLM (headers, bullet points, bold text) into HTML.

Data Flow Diagram (Sequence)

User submits Quiz -> POST /quiz -> agents.node_profiler -> SQLite (Profile Saved).

User asks "Buy iPhone?" -> POST /consult -> FastAPI.

FastAPI fetches Profile from SQLite.

LangGraph initializes:

Node A: rag.retrieve_context("iPhone luxury spending") -> returns "Hedonic Adaptation".

Node B: node_decision_maker checks bank balance vs price.

Node C: node_psychologist checks Profile ("User values minimalism") vs Item ("Luxury tech").

Node D: node_synthesizer merges A, B, C.

FastAPI returns JSON -> React renders Report.
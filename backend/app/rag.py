"""
RAG (Retrieval-Augmented Generation) module.

Interface to the Vector Knowledge Base.
All embedding and vector math are encapsulated here.
No other file should know about "cosine similarity."
"""

from typing import Optional
from chromadb import Client


def get_vector_store() -> Client:
    """
    Singleton provider for the ChromaDB client.

    Prevents re-initializing the connection on every request.

    Returns:
        Client: ChromaDB client instance
    """
    pass


def ingest_knowledge_base(directory_path: str) -> int:
    """
    Batch processor for knowledge base ingestion.

    Reads .txt/.pdf files, chunks them (token-aware), embeds them
    via OpenAI, and upserts to ChromaDB.

    Args:
        directory_path: Path to directory containing knowledge base files

    Returns:
        int: Count of chunks ingested
    """
    pass


def retrieve_context(query: str, k: int = 3) -> str:
    """
    Semantic search in the knowledge base.

    Converts a query (e.g., "impulsive buying late at night") into a vector,
    finds nearest neighbors in the knowledge base, and returns a concatenated
    string of context.

    Args:
        query: The search query string
        k: Number of top results to retrieve (default: 3)

    Returns:
        str: Concatenated context from retrieved documents
    """
    pass

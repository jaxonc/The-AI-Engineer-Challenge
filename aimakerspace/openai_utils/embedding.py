from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI
import openai
from typing import List
import os
import asyncio


class EmbeddingModel:
    def __init__(self, embeddings_model_name: str = "text-embedding-3-small"):
        self.embeddings_model_name = embeddings_model_name
        self._async_client = None
        self._client = None
        self._api_key = None
    
    def _ensure_clients(self):
        """Lazy initialization of OpenAI clients"""
        if self._async_client is None or self._client is None:
            load_dotenv()
            self._api_key = os.getenv("OPENAI_API_KEY")
            
            if self._api_key is None:
                raise ValueError(
                    "OPENAI_API_KEY environment variable is not set. Please set it to your OpenAI API key."
                )
            
            openai.api_key = self._api_key
            self._async_client = AsyncOpenAI(api_key=self._api_key)
            self._client = OpenAI(api_key=self._api_key)
    
    @property
    def async_client(self):
        self._ensure_clients()
        return self._async_client
    
    @property 
    def client(self):
        self._ensure_clients()
        return self._client

    async def async_get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        embedding_response = await self.async_client.embeddings.create(
            input=list_of_text, model=self.embeddings_model_name
        )

        return [embeddings.embedding for embeddings in embedding_response.data]

    async def async_get_embedding(self, text: str) -> List[float]:
        embedding = await self.async_client.embeddings.create(
            input=text, model=self.embeddings_model_name
        )

        return embedding.data[0].embedding

    def get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        embedding_response = self.client.embeddings.create(
            input=list_of_text, model=self.embeddings_model_name
        )

        return [embeddings.embedding for embeddings in embedding_response.data]

    def get_embedding(self, text: str) -> List[float]:
        embedding = self.client.embeddings.create(
            input=text, model=self.embeddings_model_name
        )

        return embedding.data[0].embedding


if __name__ == "__main__":
    embedding_model = EmbeddingModel()
    print(asyncio.run(embedding_model.async_get_embedding("Hello, world!")))
    print(
        asyncio.run(
            embedding_model.async_get_embeddings(["Hello, world!", "Goodbye, world!"])
        )
    )

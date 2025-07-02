from openai import OpenAI, AsyncOpenAI
from dotenv import load_dotenv
import os

load_dotenv()


class ChatOpenAI:
    def __init__(self, model_name: str = "gpt-4o-mini"):
        self.model_name = model_name
        self._openai_api_key = None
        self._client = None
        self._async_client = None
    
    def _ensure_client(self):
        """Lazy initialization of OpenAI client"""
        if self._client is None:
            self._openai_api_key = os.getenv("OPENAI_API_KEY")
            if self._openai_api_key is None:
                raise ValueError("OPENAI_API_KEY is not set")
            self._client = OpenAI(api_key=self._openai_api_key)
    
    def _ensure_async_client(self):
        """Lazy initialization of async OpenAI client"""
        if self._async_client is None:
            self._openai_api_key = os.getenv("OPENAI_API_KEY")
            if self._openai_api_key is None:
                raise ValueError("OPENAI_API_KEY is not set")
            self._async_client = AsyncOpenAI(api_key=self._openai_api_key)

    def run(self, messages, text_only: bool = True, **kwargs):
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")

        self._ensure_client()
        response = self._client.chat.completions.create(
            model=self.model_name, messages=messages, **kwargs
        )

        if text_only:
            return response.choices[0].message.content

        return response
    
    async def astream(self, messages, **kwargs):
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")
        
        self._ensure_async_client()
        
        stream = await self._async_client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            stream=True,
            **kwargs
        )

        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                yield content

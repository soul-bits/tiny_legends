"""
Shared Pydantic models for story breakdown and illustration generation.

This module contains all the shared data models used across the story breakdown
and illustration generation modules to avoid duplication.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

class StoryCard(BaseModel):
    """Represents a single story card with content, illustration prompt, narration, and optional file paths."""
    
    card_number: int = Field(description="The sequential number of this card (1-9)")
    content: str = Field(description="The story content for this card, 1-2 sentences")
    illustration_prompt: str = Field(description="Detailed prompt for generating the illustration")
    spoken_narration: str = Field(description="The narration text to be spoken aloud")
    illustration_path: Optional[str] = Field(default=None, description="Path to the generated illustration image file")
    audio_path: Optional[str] = Field(default=None, description="Path to the generated narration audio file")

class StoryBreakdown(BaseModel):
    """Complete breakdown of a story into 9 illustrated cards."""
    
    title: str = Field(description="The title of the story")
    summary: str = Field(description="Brief summary of the entire story")
    cards: List[StoryCard] = Field(description="List of 9 story cards", min_length=9, max_length=9)

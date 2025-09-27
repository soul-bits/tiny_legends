"""
Story Breakdown Module

This module breaks down a story summary into 9 illustrated story cards
using OpenAI SDK and Pydantic models for structured output.
"""

from typing import List, Optional
from openai import OpenAI
import os
from dotenv import load_dotenv
from models import StoryCard, StoryBreakdown

# Load environment variables
load_dotenv()

class StoryBreakdownGenerator:
    """Generates story breakdowns using OpenAI's GPT models."""
    
    # System prompt for story breakdown
    SYSTEM_PROMPT = """You are a children's story expert who specializes in breaking down stories into 9 illustrated story cards.

For each story card, you must provide:
1. Content: 1-2 sentences that tell part of the story
2. Illustration Prompt: Detailed description for creating a visual illustration based on the content
3. Spoken Narration: Narration script optimized for reading aloud to children

Guidelines:
- Define the characters and their descriptions in the story illustration prompt.
- Make the story engaging and age-appropriate for children
- Each card should advance the plot naturally
- Illustration prompts should be vivid and descriptive with at max 1 chat bubble
- Spoken narration should flow smoothly when read aloud
- Maintain consistency in characters and setting
- Ensure the story has a clear beginning, middle, and end across all 9 cards

The story should be broken into these 9 parts:
1. Introduction/Setting (Cards 1-2)
2. Rising Action/Problem (Cards 3-4) 
3. Climax/Adventure (Cards 5-6)
4. Resolution (Cards 7-8)
5. Conclusion (Card 9)

IMPORTANT: Return the response as a JSON object with this EXACT structure:
{
  "title": "Story Title",
  "summary": "Brief story summary",
  "cards": [
    {
      "card_number": 1,
      "content": "Story content for card 1",
      "illustration_prompt": "Illustration description for card 1",
      "spoken_narration": "Narration for card 1"
    },
    {
      "card_number": 2,
      "content": "Story content for card 2",
      "illustration_prompt": "Illustration description for card 2",
      "spoken_narration": "Narration for card 2"
    },
    ... (continue for all 9 cards)
  ]
}

Do NOT wrap the response in any additional object or array."""
    
    def __init__(self):
        """Initialize the generator with OpenAI API key."""
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def breakdown_story(self, story_summary: str, model: str = "gpt-4o") -> StoryBreakdown:
        """
        Break down a story summary into 9 illustrated story cards.
        
        Args:
            story_summary: The input story summary to break down
            model: OpenAI model to use (default: gpt-4o)
            
        Returns:
            StoryBreakdown object with 9 story cards
        """
        
        user_prompt = f"""Please break down this story into 9 illustrated story cards:

Story Summary: {story_summary}

Create engaging, child-friendly content with vivid illustration prompts and smooth narration for each card."""

        return self._generate_breakdown(user_prompt, model)
    
    def breakdown_story_with_example(self, story_summary: str, model: str = "gpt-4o") -> StoryBreakdown:
        """
        Break down a story with an example to guide the AI.
        
        Args:
            story_summary: The input story summary to break down
            model: OpenAI model to use (default: gpt-4o)
            
        Returns:
            StoryBreakdown object with 9 story cards
        """
        
        user_prompt = f"""Please break down this story into 9 illustrated story cards:

Story Summary: {story_summary}

Create engaging, child-friendly content with vivid illustration prompts and smooth narration for each card."""

        return self._generate_breakdown(user_prompt, model)
    
    def _generate_breakdown(self, user_prompt: str, model: str) -> StoryBreakdown:
        """
        Internal method to generate story breakdown using OpenAI API.
        
        Args:
            user_prompt: The user prompt for the story
            model: OpenAI model to use
            
        Returns:
            StoryBreakdown object with 9 story cards
        """
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=4000
            )
            
            # Parse the JSON response
            import json
            response_data = json.loads(response.choices[0].message.content)
            
            # Validate and create the StoryBreakdown object
            return StoryBreakdown(**response_data)
            
        except Exception as e:
            raise Exception(f"Error generating story breakdown: {str(e)}")

def create_story_cards(story_summary: str) -> StoryBreakdown:
    """
    Convenience function to create story cards from a summary (text only).
    
    This function generates a complete story breakdown with:
    - Title and summary
    - 9 story cards with content, illustration prompts, and narration
    - No image generation (saves credits)
    
    Args:
        story_summary: The story to break down
        
    Returns:
        StoryBreakdown object with 9 story cards (text only)
    """
    generator = StoryBreakdownGenerator()
    
    # Generate story breakdown (text only)
    print("📚 Generating story breakdown...")
    breakdown = generator.breakdown_story_with_example(story_summary)
    
    print("✅ Complete! Story breakdown generated (text only - saves credits).")
    return breakdown

# Example usage
if __name__ == "__main__":
    # Example story
    example_story = """
    Long ago, in the village of Gokul, lived a playful boy named Krishna. He had a smile brighter than the sun and eyes that twinkled like stars. But Krishna was not just any boy—he was very special.

Krishna loved butter more than anything. Every morning, his mother, Yashoda, would churn fresh butter and keep it safe. But Krishna and his friends couldn’t resist. They climbed on each other’s shoulders, sneaked into houses, and stole pots of butter. Villagers laughed and called him Makhan Chor—the Butter Thief.

One day, Yashoda caught Krishna with his little hands full of butter. She tried to scold him, but when she looked into his big innocent eyes, her anger melted. Krishna smiled, and Yashoda’s heart overflowed with love.

But Krishna was not only mischievous; he was brave too. Once, a giant serpent entered the village’s river. Everyone was afraid. Krishna jumped onto the serpent’s head and danced until the creature gave up and left. The villagers cheered—Krishna had saved them!

From stealing butter to protecting his people, Krishna showed that love, courage, and playfulness can go hand in hand. And that is why children everywhere still adore him today.
    """
    try:
        # Create story breakdown (text only - saves credits)
        print("=== STORY BREAKDOWN (Text Only) ===")
        breakdown = create_story_cards(example_story)
        
        print(f"\nStory Title: {breakdown.title}")
        print(f"Summary: {breakdown.summary}")
        print("\n" + "="*50 + "\n")
        
        for card in breakdown.cards:
            print(f"Card {card.card_number}:")
            print(f"Content: {card.content}")
            print(f"Illustration: {card.illustration_prompt}")
            print(f"Narration: {card.spoken_narration}")
            print("-" * 30)
        
        print("\n💡 To generate illustrations, use the illustration_generator.py module!")
            
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure to set your OPENAI_API_KEY in the .env file")

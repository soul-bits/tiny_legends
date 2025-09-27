#!/usr/bin/env python3
"""
Kids Story Generator using OpenAI's cheapest model
Generates educational stories for children under 200 words
"""

import os
import random
from typing import List, Dict
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class KidsStoryGenerator:
    def __init__(self):
        """Initialize the story generator with OpenAI client"""
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.learning_themes = [
            "sharing with friends",
            "being brave and courageous", 
            "helping people in need",
            "being kind to animals",
            "telling the truth",
            "working hard and not giving up",
            "being respectful to elders",
            "taking care of the environment",
            "being grateful for what you have",
            "making friends and being inclusive",
            "learning from mistakes",
            "being patient and waiting your turn",
            "standing up for what's right",
            "being creative and using imagination",
            "showing empathy and understanding others"
        ]
    
    def generate_story(self, custom_theme: str = None) -> Dict[str, str]:
        """
        Generate a kids story with a random learning theme
        
        Args:
            custom_theme: Optional custom learning theme
            
        Returns:
            Dictionary containing the story and theme used
        """
        # Select a random learning theme
        theme = custom_theme if custom_theme else random.choice(self.learning_themes)
        
        # Create the prompt for story generation
        prompt = f"""Write a short story for kids (under 200 words) that teaches about {theme}.

Requirements:
- Define the characters and their descriptions in the story.
- Use simple, easy words that children can understand
- Keep the story engaging and fun
- Include characters that kids can relate to
- Make the lesson clear but not preachy
- End with a positive message
- Use dialogue to make it more interesting
- Keep it under 200 words exactly

Story:"""

        try:
            # Call OpenAI API using the cheapest model (gpt-3.5-turbo)
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a children's story writer who creates engaging, educational stories for kids aged 5-10."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,  # Limit tokens to keep under 200 words
                temperature=0.8,  # Add some creativity
                top_p=0.9
            )
            
            story = response.choices[0].message.content.strip()
            
            return {
                "story": story,
                "theme": theme,
                "word_count": len(story.split()),
                "status": "success"
            }
            
        except Exception as e:
            return {
                "story": "",
                "theme": theme,
                "word_count": 0,
                "status": "error",
                "error": str(e)
            }
    
    def get_available_themes(self) -> List[str]:
        """Get list of available learning themes"""
        return self.learning_themes.copy()
    
    def add_custom_theme(self, theme: str) -> None:
        """Add a custom learning theme to the list"""
        if theme not in self.learning_themes:
            self.learning_themes.append(theme)
    
    def generate_multiple_stories(self, count: int = 3) -> List[Dict[str, str]]:
        """Generate multiple stories with different themes"""
        stories = []
        for _ in range(count):
            story = self.generate_story()
            stories.append(story)
        return stories


def main():
    """Main function to demonstrate the story generator"""
    # Check if API key is set
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: Please set your OPENAI_API_KEY environment variable")
        print("You can create a .env file with: OPENAI_API_KEY=your_api_key_here")
        return
    
    # Initialize the generator
    generator = KidsStoryGenerator()
    
    print("🎭 Kids Story Generator 🎭")
    print("=" * 50)
    
    # Generate a single story
    print("\n📚 Generating a random story...")
    story_result = generator.generate_story()
    
    if story_result["status"] == "success":
        print(f"\n🎯 Learning Theme: {story_result['theme']}")
        print(f"📊 Word Count: {story_result['word_count']}")
        print(f"\n📖 Story:\n{story_result['story']}")
    else:
        print(f"❌ Error generating story: {story_result.get('error', 'Unknown error')}")
    
    # Show available themes
    print(f"\n🎨 Available Learning Themes ({len(generator.get_available_themes())}):")
    for i, theme in enumerate(generator.get_available_themes(), 1):
        print(f"  {i}. {theme}")


if __name__ == "__main__":
    main()

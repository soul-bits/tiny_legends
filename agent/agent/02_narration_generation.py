"""
Narration Generation Module

This module handles the generation of audio narration for story cards using OpenAI's TTS (Text-to-Speech) API.
It works with story breakdown JSON data to generate audio files for each card's spoken narration.
"""

from typing import List, Optional, Dict, Any
from openai import OpenAI
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from models import StoryCard, StoryBreakdown

# Load environment variables
load_dotenv()

def get_timestamped_dir(base_name="audio"):
    """Generate a timestamped directory name in format: YYYYMMDD_HHMMSS/audio"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"output/{timestamp}/{base_name}"

class NarrationGenerator:
    """Generates audio narration using OpenAI's TTS API."""
    
    def __init__(self):
        """Initialize the generator with OpenAI API key."""
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def generate_narration(self, text: str, output_path: str = "narration.mp3", voice: str = "alloy") -> str:
        """
        Generate audio narration using OpenAI TTS.
        
        Args:
            text: The text to convert to speech
            output_path: Path to save the generated audio file
            voice: Voice to use (alloy, echo, fable, onyx, nova, shimmer)
            
        Returns:
            Path to the saved audio file
        """
        try:
            response = self.client.audio.speech.create(
                model="tts-1",  # or "tts-1-hd" for higher quality
                voice=voice,
                input=text,
                response_format="mp3"
            )

            # Save the audio file
            with open(output_path, "wb") as f:
                f.write(response.content)
            print(f"Audio saved as {output_path}")
            return output_path
                
        except Exception as e:
            raise Exception(f"Error generating narration: {str(e)}")
    
    def generate_all_narrations(self, breakdown, output_dir: str = "audio") -> List[str]:
        """
        Generate audio narrations for all story cards.
        
        Args:
            breakdown: The story breakdown object
            output_dir: Directory to save all audio files
            
        Returns:
            List of paths to generated audio files
        """
        import os
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        audio_paths = []
        
        for card in breakdown.cards:
            output_path = os.path.join(output_dir, f"card_{card.card_number:02d}_narration.mp3")
            try:
                generated_path = self.generate_narration(card.spoken_narration, output_path)
                audio_paths.append(generated_path)
                print(f"✅ Generated narration for Card {card.card_number}")
            except Exception as e:
                print(f"❌ Failed to generate narration for Card {card.card_number}: {e}")
                audio_paths.append(None)
        
        return audio_paths

def generate_narrations_from_json(story_breakdown_json: str, output_dir: str = None) -> Dict[str, Any]:
    """
    Generate audio narrations for story cards from JSON data.
    
    Args:
        story_breakdown_json: JSON string of the story breakdown
        output_dir: Directory to save the generated audio files (default: timestamped directory)
        
    Returns:
        Dictionary with updated story breakdown including audio paths
    """
    try:
        # Use timestamped directory if none provided
        if output_dir is None:
            output_dir = get_timestamped_dir()
        
        # Parse the story breakdown JSON
        breakdown_data = json.loads(story_breakdown_json)
        
        if not breakdown_data.get("success", False):
            return {
                "success": False,
                "error": "Invalid story breakdown data provided"
            }
        
        # Create StoryCard objects from the JSON data
        cards = []
        for card_data in breakdown_data["cards"]:
            card = StoryCard(
                card_number=card_data["card_number"],
                content=card_data["content"],
                illustration_prompt=card_data["illustration_prompt"],
                spoken_narration=card_data["spoken_narration"],
                illustration_path=card_data.get("illustration_path"),
                audio_path=None
            )
            cards.append(card)
        
        # Create a temporary breakdown object for processing (bypass validation for flexibility)
        class FlexibleStoryBreakdown:
            def __init__(self, title, summary, cards):
                self.title = title
                self.summary = summary
                self.cards = cards
        
        breakdown = FlexibleStoryBreakdown(
            title=breakdown_data["title"],
            summary=breakdown_data["summary"],
            cards=cards
        )
        
        # Generate narrations
        generator = NarrationGenerator()
        audio_paths = generator.generate_all_narrations(breakdown, output_dir)
        
        # Update each card with its audio path
        for i, card in enumerate(breakdown.cards):
            if i < len(audio_paths) and audio_paths[i] is not None:
                card.audio_path = audio_paths[i]
        
        # Format the response
        result = {
            "success": True,
            "title": breakdown.title,
            "summary": breakdown.summary,
            "total_cards": len(breakdown.cards),
            "narrations_generated": len([p for p in audio_paths if p is not None]),
            "cards": []
        }
        
        # Add each card's information with updated audio paths
        for card in breakdown.cards:
            card_info = {
                "card_number": card.card_number,
                "content": card.content,
                "illustration_prompt": card.illustration_prompt,
                "spoken_narration": card.spoken_narration,
                "has_illustration": card.illustration_path is not None,
                "illustration_path": card.illustration_path,
                "has_audio": card.audio_path is not None,
                "audio_path": card.audio_path
            }
            result["cards"].append(card_info)
        
        return result
        
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"Invalid JSON format: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to generate narrations: {str(e)}"
        }

# Example usage
if __name__ == "__main__":
    # Example story breakdown JSON (9 cards as required)
    example_json = '''
    {
        "success": true,
        "title": "Test Story",
        "summary": "A test story for narration generation",
        "total_cards": 9,
        "cards": [
            {
                "card_number": 1,
                "content": "Once upon a time, there was a brave little mouse.",
                "illustration_prompt": "A brave little mouse standing confidently in a garden",
                "spoken_narration": "Once upon a time, there was a brave little mouse."
            },
            {
                "card_number": 2,
                "content": "The mouse discovered a magical garden.",
                "illustration_prompt": "A magical garden with colorful flowers and sparkling lights",
                "spoken_narration": "The mouse discovered a magical garden."
            },
            {
                "card_number": 3,
                "content": "The flowers could talk and sing beautiful songs.",
                "illustration_prompt": "Talking flowers with happy faces singing in a garden",
                "spoken_narration": "The flowers could talk and sing beautiful songs."
            },
            {
                "card_number": 4,
                "content": "Pip made friends with all the flowers.",
                "illustration_prompt": "Pip the mouse surrounded by friendly talking flowers",
                "spoken_narration": "Pip made friends with all the flowers."
            },
            {
                "card_number": 5,
                "content": "One day, a storm threatened the magical garden.",
                "illustration_prompt": "Dark storm clouds approaching a beautiful garden",
                "spoken_narration": "One day, a storm threatened the magical garden."
            },
            {
                "card_number": 6,
                "content": "Pip bravely protected his flower friends.",
                "illustration_prompt": "Pip standing bravely in front of flowers during a storm",
                "spoken_narration": "Pip bravely protected his flower friends."
            },
            {
                "card_number": 7,
                "content": "The storm passed and the garden was safe.",
                "illustration_prompt": "Sunshine returning to the garden after the storm",
                "spoken_narration": "The storm passed and the garden was safe."
            },
            {
                "card_number": 8,
                "content": "All the flowers thanked Pip for his courage.",
                "illustration_prompt": "Flowers bowing and thanking Pip the mouse",
                "spoken_narration": "All the flowers thanked Pip for his courage."
            },
            {
                "card_number": 9,
                "content": "Pip and the flowers lived happily ever after.",
                "illustration_prompt": "Pip and flowers celebrating together in the garden",
                "spoken_narration": "Pip and the flowers lived happily ever after."
            }
        ]
    }
    '''
    
    try:
        print("🎵 Testing narration generation...")
        result = generate_narrations_from_json(example_json, "output/test_narrations")
        
        if result["success"]:
            print(f"✅ Generated {result['narrations_generated']} narrations!")
            print(f"Title: {result['title']}")
        else:
            print(f"❌ Error: {result['error']}")
            
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure to set your OPENAI_API_KEY in the .env file")

"""
Illustration Generator Module

This module handles the generation of illustrations for story cards using DALL-E 3.
It works with story breakdown JSON data to generate images for each card.
"""

from typing import List, Optional, Dict, Any
from openai import OpenAI
import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv
from models import StoryCard, StoryBreakdown

# Load environment variables
load_dotenv()

def get_timestamped_dir(base_name="illustrations"):
    """Generate a timestamped directory name in format: YYYYMMDD_HHMMSS/illustrations"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{timestamp}/{base_name}"

def get_shared_timestamped_dir():
    """Generate a shared timestamped directory for a session (without subdirectory)."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{timestamp}"

class IllustrationGenerator:
    """Generates illustrations using OpenAI's DALL-E 3."""
    
    def __init__(self):
        """Initialize the generator with OpenAI API key."""
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def generate_illustration(self, prompt: str, output_path: str = "illustration.png") -> str:
        """
        Generate an illustration using DALL-E 3.
        
        Args:
            prompt: The illustration prompt
            output_path: Path to save the generated image
            
        Returns:
            Path to the saved image file
        """
        try:
            response = self.client.images.generate(
                model="dall-e-3",
                prompt=f"You are a children's story expert who specializes in creating animated kids friendly illustrations for story cards. {prompt}",
                size="1024x1024",
                quality="standard",  # standard, hd
                n=1,
            )

            # Get the image URL
            image_url = response.data[0].url

            # Download the image
            image_response = requests.get(image_url)
            if image_response.status_code == 200:
                with open(output_path, "wb") as f:
                    f.write(image_response.content)
                print(f"Image saved as {output_path}")
                return output_path
            else:
                raise Exception(f"Failed to download image: HTTP {image_response.status_code}")
                
        except Exception as e:
            raise Exception(f"Error generating illustration: {str(e)}")
    
    def generate_all_illustrations(self, breakdown: StoryBreakdown, output_dir: str = "illustrations") -> List[str]:
        """
        Generate illustrations for all story cards.
        
        Args:
            breakdown: The story breakdown object
            output_dir: Directory to save all illustrations
            
        Returns:
            List of paths to generated image files
        """
        import os
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        image_paths = []
        
        for card in breakdown.cards:
            output_path = os.path.join(output_dir, f"card_{card.card_number:02d}.png")
            try:
                generated_path = self.generate_illustration(card.illustration_prompt, output_path)
                image_paths.append(generated_path)
                print(f"✅ Generated illustration for Card {card.card_number}")
            except Exception as e:
                print(f"❌ Failed to generate illustration for Card {card.card_number}: {e}")
                image_paths.append(None)
        
        return image_paths

def generate_illustrations_from_json(story_breakdown_json: str, output_dir: str = None) -> Dict[str, Any]:
    """
    Generate illustrations for story cards from JSON data.
    
    Args:
        story_breakdown_json: JSON string of the story breakdown
        output_dir: Directory to save the generated illustrations (default: timestamped directory)
        
    Returns:
        Dictionary with updated story breakdown including illustration paths
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
        
        # Create a StoryBreakdown object from the JSON data
        cards = []
        for card_data in breakdown_data["cards"]:
            card = StoryCard(
                card_number=card_data["card_number"],
                content=card_data["content"],
                illustration_prompt=card_data["illustration_prompt"],
                spoken_narration=card_data["spoken_narration"],
                illustration_path=None
            )
            cards.append(card)
        
        breakdown = StoryBreakdown(
            title=breakdown_data["title"],
            summary=breakdown_data["summary"],
            cards=cards
        )
        
        # Generate illustrations
        generator = IllustrationGenerator()
        image_paths = generator.generate_all_illustrations(breakdown, output_dir)
        
        # Update each card with its illustration path
        for i, card in enumerate(breakdown.cards):
            if i < len(image_paths) and image_paths[i] is not None:
                card.illustration_path = image_paths[i]
        
        # Format the response
        result = {
            "success": True,
            "title": breakdown.title,
            "summary": breakdown.summary,
            "total_cards": len(breakdown.cards),
            "illustrations_generated": len([p for p in image_paths if p is not None]),
            "cards": []
        }
        
        # Add each card's information with updated illustration paths
        for card in breakdown.cards:
            card_info = {
                "card_number": card.card_number,
                "content": card.content,
                "illustration_prompt": card.illustration_prompt,
                "spoken_narration": card.spoken_narration,
                "has_illustration": card.illustration_path is not None,
                "illustration_path": card.illustration_path
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
            "error": f"Failed to generate illustrations: {str(e)}"
        }

# Example usage
if __name__ == "__main__":
    # Example story breakdown JSON (9 cards as required)
    example_json = '''
    {
        "success": true,
        "title": "Test Story",
        "summary": "A test story for illustration generation",
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
        print("🎨 Testing illustration generation...")
        result = generate_illustrations_from_json(example_json, "test_illustrations")
        
        if result["success"]:
            print(f"✅ Generated {result['illustrations_generated']} illustrations!")
            print(f"Title: {result['title']}")
        else:
            print(f"❌ Error: {result['error']}")
            
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure to set your OPENAI_API_KEY in the .env file")

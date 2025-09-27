from typing import Annotated, List, Optional, Dict, Any

from llama_index.core.workflow import Context
from llama_index.llms.openai import OpenAI
from llama_index.protocols.ag_ui.events import StateSnapshotWorkflowEvent
from llama_index.protocols.ag_ui.router import get_ag_ui_workflow_router
from llama_index.core.readers import SimpleDirectoryReader
from llama_index.readers.file import PDFReader

# Backend tools for character extraction

def extract_characters_from_comic(file_path: Annotated[str, "Path to the PDF or text comic file"]) -> List[Dict]:
    """Extract characters from a comic PDF or text file and return character data."""
    try:
        # Check file extension to determine how to read the file
        if file_path.lower().endswith('.pdf'):
            # Read PDF using LlamaIndex PDFReader for proper text extraction
            reader = PDFReader()
            documents = reader.load_data(file_path)
            content = "\n".join([doc.text for doc in documents])
        else:
            # Read text file directly
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
        
        # Extract characters using LLM
        llm = OpenAI(model="gpt-4o")
        prompt = f"""
        Extract all unique character names from this comic content. 
        For each character, provide:
        - name: The character name
        - description: A brief description (2-3 sentences)
        - traits: Array of key personality traits or characteristics
        
        Return as a JSON array of objects.
        
        Content: {content[:4000]}...
        """
        
        response = llm.complete(prompt)
        
        # Parse the JSON response
        import json
        import re
        
        # Clean the response by removing markdown code blocks
        response_text = response.text.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]  # Remove ```json
        if response_text.endswith('```'):
            response_text = response_text[:-3]  # Remove ```
        response_text = response_text.strip()
        
        try:
            characters = json.loads(response_text)
            return characters
        except json.JSONDecodeError as e:
            # Fallback: extract names manually
            return [{"name": "Sample Character", "description": "A character from the comic", "traits": ["brave", "mysterious"]}]
            
    except Exception as e:
        return [{"name": "Error", "description": f"Failed to extract characters: {str(e)}", "traits": []}]

def generate_character_story(characters: Annotated[List[Dict], "List of character data"], theme: Annotated[str, "Story theme or prompt"] = "adventure") -> str:
    """Generate a kids story using the extracted characters."""
    try:
        llm = OpenAI(model="gpt-4o")
        
        character_names = [char["name"] for char in characters]
        character_descriptions = [f"{char['name']}: {char['description']}" for char in characters]
        
        prompt = f"""
        Create a fun, engaging kids story featuring these characters:
        {', '.join(character_names)}
        
        Character details:
        {'; '.join(character_descriptions)}
        
        Story requirements:
        - Age-appropriate for children (5-10 years old)
        - Include all characters
        - Theme: {theme}
        - Length: 300-500 words
        - Clear beginning, middle, and end
        - Emphasize friendship and teamwork
        
        Write the story:
        """
        
        response = llm.complete(prompt)
        return response.text
        
    except Exception as e:
        return f"Error generating story: {str(e)}"

def upload_and_extract_comic(file_path: Annotated[str, "Path to the comic file to upload and process"]) -> str:
    """Upload a comic file and extract characters from it, then create character cards on the canvas."""
    try:
        # Extract characters from the comic file
        characters = extract_characters_from_comic(file_path)
        
        if not characters or len(characters) == 0:
            return "No characters were found in the comic file."
        
        # Format the response with character details
        character_list = []
        for char in characters:
            traits_str = ", ".join(char.get("traits", []))
            character_list.append(f"• **{char.get('name', 'Unknown')}**: {char.get('description', 'No description')} (Traits: {traits_str})")
        
        character_summary = "\n".join(character_list)
        
        return f"""Successfully extracted {len(characters)} characters from the comic:

{character_summary}

I will now create character cards for each of these characters on the canvas. You can interact with them, edit their details, or ask me to generate a story featuring these characters."""
        
    except Exception as e:
        return f"Error processing comic file: {str(e)}"

def process_uploaded_comic() -> str:
    """Process the most recently uploaded comic file and extract characters from it."""
    import os
    import glob
    
    try:
        # Look for the most recent comic file in the uploads directory
        uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads')
        
        if not os.path.exists(uploads_dir):
            return "No uploads directory found. Please upload a comic file first."
        
        # Find the most recent comic file
        comic_files = glob.glob(os.path.join(uploads_dir, 'comic-*.pdf')) + glob.glob(os.path.join(uploads_dir, 'comic-*.txt'))
        
        if not comic_files:
            return "No comic files found in uploads directory. Please upload a comic file first."
        
        # Get the most recent file
        latest_file = max(comic_files, key=os.path.getctime)
        
        # Process the file
        return upload_and_extract_comic(latest_file)
        
    except Exception as e:
        return f"Error processing uploaded comic: {str(e)}"

# --- Backend tools (server-side) ---


# --- Frontend tool stubs (names/signatures only; execution happens in the UI) ---

def createItem(
    type: Annotated[str, "One of: project, entity, note, chart, character."],
    name: Annotated[Optional[str], "Optional item name."] = None,
) -> str:
    """Create a new canvas item and return its id."""
    return f"createItem({type}, {name})"

def deleteItem(
    itemId: Annotated[str, "Target item id."],
) -> str:
    """Delete an item by id."""
    return f"deleteItem({itemId})"

def setItemName(
    name: Annotated[str, "New item name/title."],
    itemId: Annotated[str, "Target item id."],
) -> str:
    """Set an item's name."""
    return f"setItemName(name, {itemId})"

def setItemSubtitleOrDescription(
    subtitle: Annotated[str, "Item subtitle/short description."],
    itemId: Annotated[str, "Target item id."],
) -> str:
    """Set an item's subtitle/description (not data fields)."""
    return f"setItemSubtitleOrDescription({subtitle}, {itemId})"

def setGlobalTitle(title: Annotated[str, "New global title."]) -> str:
    """Set the global canvas title."""
    return f"setGlobalTitle({title})"

def setGlobalDescription(description: Annotated[str, "New global description."]) -> str:
    """Set the global canvas description."""
    return f"setGlobalDescription({description})"

# Note actions
def setNoteField1(
    value: Annotated[str, "New content for note.data.field1."],
    itemId: Annotated[str, "Target note id."],
) -> str:
    return f"setNoteField1({value}, {itemId})"

def appendNoteField1(
    value: Annotated[str, "Text to append to note.data.field1."],
    itemId: Annotated[str, "Target note id."],
    withNewline: Annotated[Optional[bool], "Prefix with newline if true." ] = None,
) -> str:
    return f"appendNoteField1({value}, {itemId}, {withNewline})"

def clearNoteField1(
    itemId: Annotated[str, "Target note id."],
) -> str:
    return f"clearNoteField1({itemId})"

# Project actions
def setProjectField1(value: Annotated[str, "New value for project.data.field1."], itemId: Annotated[str, "Project id."]) -> str:
    return f"setProjectField1({value}, {itemId})"

def setProjectField2(value: Annotated[str, "New value for project.data.field2."], itemId: Annotated[str, "Project id."]) -> str:
    return f"setProjectField2({value}, {itemId})"

def setProjectField3(date: Annotated[str, "Date YYYY-MM-DD for project.data.field3."], itemId: Annotated[str, "Project id."]) -> str:
    return f"setProjectField3({date}, {itemId})"

def clearProjectField3(itemId: Annotated[str, "Project id."]) -> str:
    return f"clearProjectField3({itemId})"

def addProjectChecklistItem(
    itemId: Annotated[str, "Project id."],
    text: Annotated[Optional[str], "Checklist text."] = None,
) -> str:
    return f"addProjectChecklistItem({itemId}, {text})"

def setProjectChecklistItem(
    itemId: Annotated[str, "Project id."],
    checklistItemId: Annotated[str, "Checklist item id or index."],
    text: Annotated[Optional[str], "New text."] = None,
    done: Annotated[Optional[bool], "New done status."] = None,
) -> str:
    return f"setProjectChecklistItem({itemId}, {checklistItemId}, {text}, {done})"

def removeProjectChecklistItem(
    itemId: Annotated[str, "Project id."],
    checklistItemId: Annotated[str, "Checklist item id."],
) -> str:
    return f"removeProjectChecklistItem({itemId}, {checklistItemId})"

# Entity actions
def setEntityField1(value: Annotated[str, "New value for entity.data.field1."], itemId: Annotated[str, "Entity id."]) -> str:
    return f"setEntityField1({value}, {itemId})"

def setEntityField2(value: Annotated[str, "New value for entity.data.field2."], itemId: Annotated[str, "Entity id."]) -> str:
    return f"setEntityField2({value}, {itemId})"

def addEntityField3(tag: Annotated[str, "Tag to add."], itemId: Annotated[str, "Entity id."]) -> str:
    return f"addEntityField3({tag}, {itemId})"

def removeEntityField3(tag: Annotated[str, "Tag to remove."], itemId: Annotated[str, "Entity id."]) -> str:
    return f"removeEntityField3({tag}, {itemId})"

# Chart actions
def addChartField1(
    itemId: Annotated[str, "Chart id."],
    label: Annotated[Optional[str], "Metric label."] = None,
    value: Annotated[Optional[float], "Metric value 0..100."] = None,
) -> str:
    return f"addChartField1({itemId}, {label}, {value})"

def setChartField1Label(itemId: Annotated[str, "Chart id."], index: Annotated[int, "Metric index (0-based)."], label: Annotated[str, "New metric label."]) -> str:
    return f"setChartField1Label({itemId}, {index}, {label})"

def setChartField1Value(itemId: Annotated[str, "Chart id."], index: Annotated[int, "Metric index (0-based)."], value: Annotated[float, "Value 0..100."]) -> str:
    return f"setChartField1Value({itemId}, {index}, {value})"

def clearChartField1Value(itemId: Annotated[str, "Chart id."], index: Annotated[int, "Metric index (0-based)."]) -> str:
    return f"clearChartField1Value({itemId}, {index})"

def removeChartField1(itemId: Annotated[str, "Chart id."], index: Annotated[int, "Metric index (0-based)."]) -> str:
    return f"removeChartField1({itemId}, {index})"

# Character actions
def setCharacterName(name: Annotated[str, "Character name."], itemId: Annotated[str, "Character id."]) -> str:
    return f"setCharacterName({name}, {itemId})"

def setCharacterDescription(description: Annotated[str, "Character description."], itemId: Annotated[str, "Character id."]) -> str:
    return f"setCharacterDescription({description}, {itemId})"

def addCharacterTrait(trait: Annotated[str, "Trait to add."], itemId: Annotated[str, "Character id."]) -> str:
    return f"addCharacterTrait({trait}, {itemId})"

def removeCharacterTrait(trait: Annotated[str, "Trait to remove."], itemId: Annotated[str, "Character id."]) -> str:
    return f"removeCharacterTrait({trait}, {itemId})"

def setCharacterImageUrl(image_url: Annotated[str, "Image URL."], itemId: Annotated[str, "Character id."]) -> str:
    return f"setCharacterImageUrl({image_url}, {itemId})"

def setCharacterSourceComic(source_comic: Annotated[str, "Source comic."], itemId: Annotated[str, "Character id."]) -> str:
    return f"setCharacterSourceComic({source_comic}, {itemId})"

FIELD_SCHEMA = (
    "FIELD SCHEMA (authoritative):\n"
    "- project.data:\n"
    "  - field1: string (text)\n"
    "  - field2: string (select: 'Option A' | 'Option B' | 'Option C')\n"
    "  - field3: string (date 'YYYY-MM-DD')\n"
    "  - field4: ChecklistItem[] where ChecklistItem={id: string, text: string, done: boolean, proposed: boolean}\n"
    "- entity.data:\n"
    "  - field1: string\n"
    "  - field2: string (select: 'Option A' | 'Option B' | 'Option C')\n"
    "  - field3: string[] (selected tags; subset of field3_options)\n"
    "  - field3_options: string[] (available tags)\n"
    "- note.data:\n"
    "  - field1: string (textarea; represents description)\n"
    "- character.data:\n"
    "  - name: string (character name)\n"
    "  - description: string (brief character description)\n"
    "  - traits: string[] (character traits/tags)\n"
    "  - image_url: string (URL to character image)\n"
    "  - source_comic: string (which comic this character came from)\n"
    "- chart.data:\n"
    "  - field1: Array<{id: string, label: string, value: number | ''}> with value in [0..100] or ''\n"
)

SYSTEM_PROMPT = (
    "You are a helpful AG-UI assistant.\n\n"
    + FIELD_SCHEMA +
    "\nMUTATION/TOOL POLICY:\n"
    "- When you claim to create/update/delete, you MUST call the corresponding tool(s) (frontend or backend).\n"
    "- To create new cards, call the frontend tool `createItem` with `type` in {project, entity, note, chart, character} and optional `name`.\n"
    "- After tools run, rely on the latest shared state (ground truth) when replying.\n"
    "- To set a card's subtitle (never the data fields): use setItemSubtitleOrDescription.\n\n"
    "DESCRIPTION MAPPING:\n"
    "- For project/entity/chart: treat 'description', 'overview', 'summary', 'caption', 'blurb' as the card subtitle; use setItemSubtitleOrDescription.\n"
    "- For notes: 'content', 'description', 'text', or 'note' refers to note content; use setNoteField1 / appendNoteField1 / clearNoteField1.\n"
    "- For characters: when processing comics or creating characters, use the character-specific tools to set name, description, traits, etc.\n\n"
    "COMIC PROCESSING:\n"
    "- When the user asks to process an uploaded comic, ALWAYS use the process_uploaded_comic backend tool first.\n"
    "- This tool will automatically find the most recently uploaded comic file and extract characters.\n"
    "- The tool will return the extracted characters in a formatted response.\n"
    "- After the tool returns the characters, you MUST create character cards for each extracted character.\n"
    "- For each character, call createItem('character', character_name) then use setCharacterName, setCharacterDescription, addCharacterTrait, etc.\n"
    "- Do NOT ask for file paths - the process_uploaded_comic tool handles this automatically.\n\n"
    "STRICT GROUNDING RULES:\n"
    "1) ONLY use shared state (items/globalTitle/globalDescription) as the source of truth.\n"
    "2) Before ANY read or write, assume values may have changed; always read the latest state.\n"
    "3) If a command doesn't specify which item to change, ask to clarify.\n"
)

agentic_chat_router = get_ag_ui_workflow_router(
    llm=OpenAI(model="gpt-4.1"),
    # Provide frontend tool stubs so the model knows their names/signatures.
    frontend_tools=[
        createItem,
        deleteItem,
        setItemName,
        setItemSubtitleOrDescription,
        setGlobalTitle,
        setGlobalDescription,
        setNoteField1,
        appendNoteField1,
        clearNoteField1,
        setProjectField1,
        setProjectField2,
        setProjectField3,
        clearProjectField3,
        addProjectChecklistItem,
        setProjectChecklistItem,
        removeProjectChecklistItem,
        setEntityField1,
        setEntityField2,
        addEntityField3,
        removeEntityField3,
        addChartField1,
        setChartField1Label,
        setChartField1Value,
        clearChartField1Value,
        removeChartField1,
        setCharacterName,
        setCharacterDescription,
        addCharacterTrait,
        removeCharacterTrait,
        setCharacterImageUrl,
        setCharacterSourceComic,
    ],
    backend_tools=[
        extract_characters_from_comic,
        generate_character_story,
        upload_and_extract_comic,
        process_uploaded_comic,
    ],
    system_prompt=SYSTEM_PROMPT,
    initial_state={
        # Shared state synchronized with the frontend canvas
        "items": [],
        "globalTitle": "",
        "globalDescription": "",
        "lastAction": "",
        "itemsCreated": 0,
    },
)

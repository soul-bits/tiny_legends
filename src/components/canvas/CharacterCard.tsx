"use client";

import { cn } from "@/lib/utils";
import { X, Plus, Edit3, Save, XCircle } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import type { CharacterData } from "@/lib/canvas/types";
import { useState } from "react";

interface CharacterCardProps {
  data: CharacterData;
  onUpdateData: (updater: (prev: CharacterData) => CharacterData) => void;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  itemId?: string;
}

export function CharacterCard({ 
  data, 
  onUpdateData, 
  isEditing = false, 
  onToggleEdit,
  itemId
}: CharacterCardProps) {
  const [imageError, setImageError] = useState(false);
  
  const setCharacter = (partial: Partial<CharacterData>) => 
    onUpdateData((prev) => ({ ...prev, ...partial }));

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  const addTrait = () => {
    const newTrait = prompt("Enter a new trait:");
    if (newTrait && newTrait.trim()) {
      const currentTraits = data.traits ?? [];
      if (!currentTraits.includes(newTrait.trim())) {
        setCharacter({ traits: [...currentTraits, newTrait.trim()] });
      }
    }
  };

  const removeTrait = (index: number) => {
    const currentTraits = data.traits ?? [];
    setCharacter({ traits: currentTraits.filter((_, i) => i !== index) });
  };

  return (
    <div className="mt-4">
      {/* Character Image Section */}
      <div className="mb-4 flex justify-center">
        <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-accent/20 bg-gray-50">
          {data.image_url && !imageError ? (
            <img
              src={data.image_url}
              alt={data.name || "Character"}
              className="w-full h-full object-cover"
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-2xl mb-1">🎭</div>
                <div className="text-xs">No Image</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Character Details */}
      <div className="space-y-3">
        {/* Name */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Character Name</label>
          {isEditing ? (
            <input
              value={data.name}
              onChange={(e) => setCharacter({ name: e.target.value })}
              className="w-full rounded-md border px-2 py-1.5 text-sm outline-none transition-colors placeholder:text-gray-400 hover:ring-1 hover:ring-border focus:ring-2 focus:ring-accent/50 focus:shadow-sm focus:bg-accent/10 focus:text-accent focus:placeholder:text-accent/65"
              placeholder="Character name"
            />
          ) : (
            <div className="text-lg font-semibold text-foreground">{data.name || "Unnamed Character"}</div>
          )}
          {data.name === "New Character" && (
            <div className="text-xs text-amber-600 mt-1">💡 Ask the AI to help populate this character's details</div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
          {isEditing ? (
            <TextareaAutosize
              value={data.description}
              onChange={(e) => setCharacter({ description: e.target.value })}
              placeholder="Character description..."
              className="min-h-20 w-full resize-none rounded-md border bg-white/60 p-3 text-sm leading-6 outline-none placeholder:text-gray-400 transition-colors hover:ring-1 hover:ring-border focus:ring-2 focus:ring-accent/50 focus:shadow-sm focus:bg-accent/10 focus:text-accent focus:placeholder:text-accent/65"
              minRows={3}
            />
          ) : (
            <div className="text-sm text-muted-foreground leading-relaxed">
              {data.description || "No description available"}
            </div>
          )}
        </div>

        {/* Source Comic */}
        {/* <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Source Comic</label>
          {isEditing ? (
            <input
              value={data.source_comic}
              onChange={(e) => setCharacter({ source_comic: e.target.value })}
              className="w-full rounded-md border px-2 py-1.5 text-sm outline-none transition-colors placeholder:text-gray-400 hover:ring-1 hover:ring-border focus:ring-2 focus:ring-accent/50 focus:shadow-sm focus:bg-accent/10 focus:text-accent focus:placeholder:text-accent/65"
              placeholder="Comic name"
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              {data.source_comic || "Unknown source"}
            </div>
          )}
        </div> */}

        {/* Image URL (only in edit mode) */}
        {/* {isEditing && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Image URL</label>
            <input
              value={data.image_url}
              onChange={(e) => setCharacter({ image_url: e.target.value })}
              className="w-full rounded-md border px-2 py-1.5 text-sm outline-none transition-colors placeholder:text-gray-400 hover:ring-1 hover:ring-border focus:ring-2 focus:ring-accent/50 focus:shadow-sm focus:bg-accent/10 focus:text-accent focus:placeholder:text-accent/65"
              placeholder="https://example.com/character.jpg"
            />
          </div>
        )} */}

        {/* Traits */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-500">Traits</label>
            {isEditing && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                onClick={addTrait}
              >
                <Plus className="size-3.5" />
                Add trait
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(data.traits ?? []).map((trait, index) => (
              <div key={index} className="flex items-center gap-1 px-2 py-1 bg-accent/20 rounded-full text-xs">
                <span>{trait}</span>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => removeTrait(index)}
                    className="text-gray-400 hover:text-accent"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            {(!data.traits || data.traits.length === 0) && (
              <div className="text-xs text-primary/50 font-medium text-pretty">
                {isEditing ? "No traits yet. Add one to get started." : "No traits defined"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CharacterCard;

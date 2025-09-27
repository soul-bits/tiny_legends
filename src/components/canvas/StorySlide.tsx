"use client";

import { cn } from "@/lib/utils";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Upload, X, Plus, ChevronDown, ChevronUp, Mic, MicOff } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { StorySlideData } from "@/lib/canvas/types";

interface StorySlideProps {
  data: StorySlideData;
  onUpdateData: (updater: (prev: StorySlideData) => StorySlideData) => void;
  isEditing?: boolean;
}

interface Slide {
  id: string;
  imageUrl: string;
  audioUrl?: string;
  caption?: string;
  duration?: number; // in seconds
}

export function StorySlide({ data, onUpdateData, isEditing = false }: StorySlideProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isEditSectionExpanded, setIsEditSectionExpanded] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const slides = data.slides || [];
  const currentSlide = slides[currentSlideIndex];

  // Load available voices for TTS
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoice) {
        // Prefer English voices, fallback to first available
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en') || voice.lang.includes('en')
        );
        setSelectedVoice(englishVoice?.name || voices[0].name);
      }
    };

    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [selectedVoice]);

  // Get audio duration when audio loads
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleLoadedMetadata = () => {
        setAudioDuration(audio.duration);
      };
      
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [currentSlide?.audioUrl]);

  const setStorySlide = (partial: Partial<StorySlideData>) => 
    onUpdateData((prev) => ({ ...prev, ...partial }));

  // Audio controls
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(console.error);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  };

  // TTS functions
  const speakText = (text: string) => {
    if (!text.trim()) return;
    
    // Stop any current speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice if available
    if (selectedVoice) {
      const voice = availableVoices.find(v => v.name === selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    }
    
    // Set speech parameters
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = isMuted ? 0 : volume;
    
    utterance.onstart = () => setIsTTSPlaying(true);
    utterance.onend = () => setIsTTSPlaying(false);
    utterance.onerror = () => setIsTTSPlaying(false);
    
    speechSynthesis.speak(utterance);
  };

  const stopTTS = () => {
    speechSynthesis.cancel();
    setIsTTSPlaying(false);
  };

  const toggleTTS = () => {
    if (isTTSPlaying) {
      stopTTS();
    } else {
      const textToSpeak = currentSlide?.caption || data.title || "No text available";
      speakText(textToSpeak);
    }
  };

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlideIndex(index);
      pauseAudio();
      stopTTS();
    }
  };

  const nextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      imageUrl: "",
      audioUrl: "",
      caption: "",
      duration: 5
    };
    setStorySlide({ slides: [...slides, newSlide] });
  };

  const removeSlide = (slideId: string) => {
    const newSlides = slides.filter(slide => slide.id !== slideId);
    setStorySlide({ slides: newSlides });
    if (currentSlideIndex >= newSlides.length) {
      setCurrentSlideIndex(Math.max(0, newSlides.length - 1));
    }
  };

  const updateSlide = (slideId: string, updates: Partial<Slide>) => {
    const newSlides = slides.map(slide => 
      slide.id === slideId ? { ...slide, ...updates } : slide
    );
    setStorySlide({ slides: newSlides });
  };

  const handleImageUpload = (slideId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateSlide(slideId, { imageUrl: e.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleAudioUpload = (slideId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateSlide(slideId, { audioUrl: e.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  // Auto-play functionality - start audio/TTS and advance slides
  useEffect(() => {
    if (isAutoPlay) {
      if (currentSlide?.audioUrl) {
        // Start playing audio when autoplay is enabled
        const playAudioWithAutoplay = async () => {
          if (audioRef.current) {
            try {
              await audioRef.current.play();
              setIsPlaying(true);
            } catch (error) {
              console.error('Error playing audio:', error);
            }
          }
        };
        
        playAudioWithAutoplay();
      } else if (currentSlide?.caption || data.title) {
        // If no audio but has text, use TTS
        const textToSpeak = currentSlide?.caption || data.title;
        if (textToSpeak) {
          speakText(textToSpeak);
        }
      } else {
        // If no audio or text, use duration-based timing
        const duration = currentSlide?.duration || 5;
        const timer = setTimeout(() => {
          nextSlide();
        }, duration * 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentSlideIndex, isAutoPlay, currentSlide?.audioUrl, currentSlide?.caption, data.title]);

  // Handle TTS auto-advance when TTS finishes
  useEffect(() => {
    if (isAutoPlay && !isTTSPlaying && !currentSlide?.audioUrl && (currentSlide?.caption || data.title)) {
      // TTS has finished, advance to next slide
      const timer = setTimeout(() => {
        nextSlide();
      }, 1000); // Wait a bit after TTS finishes
      
      return () => clearTimeout(timer);
    }
  }, [isTTSPlaying, isAutoPlay, currentSlide?.audioUrl, currentSlide?.caption, data.title]);

  return (
    <div className="mt-4">
      {/* Story Title */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-gray-500">Story Title</label>
        {isEditing ? (
          <input
            value={data.title}
            onChange={(e) => setStorySlide({ title: e.target.value })}
            className="w-full rounded-md border px-2 py-1.5 text-sm outline-none transition-colors placeholder:text-gray-400 hover:ring-1 hover:ring-border focus:ring-2 focus:ring-accent/50 focus:shadow-sm focus:bg-accent/10 focus:text-accent focus:placeholder:text-accent/65"
            placeholder="Enter story title..."
          />
        ) : (
          <div className="text-lg font-semibold text-foreground">{data.title || "Untitled Story"}</div>
        )}
      </div>

      {/* Main Slide Display */}
      {slides.length > 0 ? (
        <div className="space-y-4">
          {/* Current Slide */}
          <div className="relative bg-gray-50 rounded-lg overflow-hidden border-2 border-accent/20">
            <div className="aspect-video relative">
              {currentSlide?.imageUrl ? (
                <img
                  src={currentSlide.imageUrl}
                  alt={currentSlide.caption || `Slide ${currentSlideIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📖</div>
                    <div className="text-sm">No image for this slide</div>
                  </div>
                </div>
              )}
              
              {/* Slide Caption Overlay */}
              {currentSlide?.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-3">
                  <p className="text-sm">{currentSlide.caption}</p>
                </div>
              )}

              {/* Audio Controls Overlay */}
              <div className="absolute top-2 right-2 flex gap-2">
                {/* TTS Controls - Always visible if there's text to read */}
                {(currentSlide?.caption || data.title) && (
                  <button
                    onClick={toggleTTS}
                    className="bg-black/70 text-white p-2 rounded-full hover:bg-black/90 transition-colors"
                    title={isTTSPlaying ? "Stop narration" : "Read text aloud"}
                  >
                    {isTTSPlaying ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
                
                {/* Audio Controls - Only show if audio is uploaded */}
                {currentSlide?.audioUrl && (
                  <>
                    <button
                      onClick={togglePlayPause}
                      className="bg-black/70 text-white p-2 rounded-full hover:bg-black/90 transition-colors"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="bg-black/70 text-white p-2 rounded-full hover:bg-black/90 transition-colors"
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                  </>
                )}
              </div>

              {/* Navigation Arrows */}
              {slides.length > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    disabled={currentSlideIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/70 text-white p-2 rounded-full hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextSlide}
                    disabled={currentSlideIndex === slides.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/70 text-white p-2 rounded-full hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            {/* Audio Element */}
            {currentSlide?.audioUrl && (
              <audio
                ref={audioRef}
                src={currentSlide.audioUrl}
                onEnded={() => {
                  setIsPlaying(false);
                  // Auto-advance to next slide when audio ends
                  if (isAutoPlay) {
                    setTimeout(() => {
                      nextSlide();
                    }, 500); // Small delay to ensure smooth transition
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setAudioDuration(audioRef.current.duration);
                  }
                }}
              />
            )}

          </div>

          {/* Slide Counter and Controls */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Slide {currentSlideIndex + 1} of {slides.length}
            </div>
            
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isAutoPlay}
                  onChange={(e) => setIsAutoPlay(e.target.checked)}
                  className="rounded"
                />
                Auto-play
              </label>
              
              {/* Voice Selection */}
              {availableVoices.length > 0 && (
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="text-xs rounded border px-2 py-1 bg-white"
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              )}
              
              {isEditing && (
                <button
                  onClick={addSlide}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  <Plus className="size-3.5" />
                  Add Slide
                </button>
              )}
            </div>
          </div>

          {/* Slide Thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={cn(
                  "flex-shrink-0 w-16 h-12 rounded border-2 cursor-pointer transition-colors",
                  index === currentSlideIndex 
                    ? "border-accent bg-accent/10" 
                    : "border-gray-200 hover:border-gray-300"
                )}
                onClick={() => goToSlide(index)}
              >
                {slide.imageUrl ? (
                  <img
                    src={slide.imageUrl}
                    alt={`Slide ${index + 1}`}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    {index + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📚</div>
          <p className="text-sm">No slides yet. Add your first slide to start the story!</p>
          {isEditing && (
            <button
              onClick={addSlide}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              <Plus className="size-4" />
              Add First Slide
            </button>
          )}
        </div>
      )}

      {/* Edit Mode: Slide Management */}
      {isEditing && slides.length > 0 && (
        <div className="mt-6 space-y-4">
          <button
            onClick={() => setIsEditSectionExpanded(!isEditSectionExpanded)}
            className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <h4 className="text-sm font-medium text-gray-700">Edit Slides</h4>
            {isEditSectionExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
          
          {isEditSectionExpanded && (
            <div className="space-y-4">
          {slides.map((slide, index) => (
            <div key={slide.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium">Slide {index + 1}</h5>
                <button
                  onClick={() => removeSlide(slide.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(slide.id, file);
                    }}
                    className="hidden"
                    id={`image-${slide.id}`}
                  />
                  <label
                    htmlFor={`image-${slide.id}`}
                    className="flex items-center gap-2 text-xs text-accent hover:underline cursor-pointer"
                  >
                    <Upload className="h-3 w-3" />
                    Upload Image
                  </label>
                  {slide.imageUrl && (
                    <div className="mt-1 w-20 h-12 rounded border overflow-hidden">
                      <img src={slide.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Audio Upload */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Audio</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAudioUpload(slide.id, file);
                    }}
                    className="hidden"
                    id={`audio-${slide.id}`}
                  />
                  <label
                    htmlFor={`audio-${slide.id}`}
                    className="flex items-center gap-2 text-xs text-accent hover:underline cursor-pointer"
                  >
                    <Upload className="h-3 w-3" />
                    Upload Audio
                  </label>
                  {slide.audioUrl && (
                    <div className="mt-1 text-xs text-green-600">Audio uploaded</div>
                  )}
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Caption</label>
                <input
                  value={slide.caption || ""}
                  onChange={(e) => updateSlide(slide.id, { caption: e.target.value })}
                  className="w-full rounded-md border px-2 py-1 text-xs outline-none transition-colors placeholder:text-gray-400 hover:ring-1 hover:ring-border focus:ring-2 focus:ring-accent/50 focus:shadow-sm focus:bg-accent/10 focus:text-accent focus:placeholder:text-accent/65"
                  placeholder="Slide caption..."
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Duration (seconds)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={slide.duration || 5}
                  onChange={(e) => updateSlide(slide.id, { duration: parseInt(e.target.value) || 5 })}
                  className="w-20 rounded-md border px-2 py-1 text-xs outline-none transition-colors placeholder:text-gray-400 hover:ring-1 hover:ring-border focus:ring-2 focus:ring-accent/50 focus:shadow-sm focus:bg-accent/10 focus:text-accent focus:placeholder:text-accent/65"
                />
              </div>
            </div>
          ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StorySlide;

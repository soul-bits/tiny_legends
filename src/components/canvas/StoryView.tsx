"use client";

import { cn } from "@/lib/utils";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, BookOpen, X, ChevronLeft, ChevronRight, Mic, MicOff } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Item, StorySlideData } from "@/lib/canvas/types";

interface StoryViewProps {
  stories: Item[];
  onClose: () => void;
}

export function StoryView({ stories, onClose }: StoryViewProps) {
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>("alloy");
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsCache, setTtsCache] = useState<Map<string, string>>(new Map());
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Demo story data using TTS for narration
  const demoStories: Item[] = [
    {
      id: "demo-story-1",
      type: "story",
      name: "Tiny Legends Adventure",
      subtitle: "A magical journey through the canvas world",
      data: {
        title: "Tiny Legends Adventure",
        slides: [
          {
            id: "demo-slide-1",
            imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&crop=center",
            caption: "Welcome to the world of Tiny Legends! Here begins our magical adventure through the canvas where stories come to life.",
            duration: 8
          },
          {
            id: "demo-slide-2",
            imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop&crop=center",
            caption: "Our brave characters discover the canvas where all stories come to life. Each click brings new adventures and endless possibilities.",
            duration: 10
          },
          {
            id: "demo-slide-3",
            imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop&crop=center",
            caption: "With the power of imagination, they create new worlds and adventures. The canvas becomes their playground for storytelling.",
            duration: 12
          },
          {
            id: "demo-slide-4",
            imageUrl: "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=800&h=600&fit=crop&crop=center",
            caption: "And so the legend continues, with endless possibilities for new stories! Every story is a new beginning waiting to be told.",
            duration: 6
          }
        ]
      } as StorySlideData
    },
    {
      id: "demo-story-2",
      type: "story",
      name: "The Canvas Chronicles",
      subtitle: "Stories from the digital realm",
      data: {
        title: "The Canvas Chronicles",
        slides: [
          {
            id: "demo-slide-5",
            imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&h=600&fit=crop&crop=center",
            caption: "In the digital realm, characters come alive on the canvas. Each pixel tells a story, each color holds a memory.",
            duration: 9
          },
          {
            id: "demo-slide-6",
            imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&crop=center",
            caption: "Each story is a new adventure waiting to be discovered. The canvas is our gateway to infinite worlds of imagination.",
            duration: 11
          },
          {
            id: "demo-slide-7",
            imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop&crop=center",
            caption: "The canvas is infinite, and so are the stories we can tell! Every creation is a masterpiece waiting to be shared.",
            duration: 7
          }
        ]
      } as StorySlideData
    }
  ];
  
  const displayStories = stories.length > 0 ? stories : demoStories;
  const currentStory = displayStories[selectedStoryIndex];
  const storyData = currentStory?.data as StorySlideData;
  const slides = storyData?.slides || [];
  const currentSlide = slides[currentSlideIndex];

  // Available OpenAI TTS voices
  const availableVoices = [
    { name: 'alloy', label: 'Alloy (Neutral)' },
    { name: 'echo', label: 'Echo (Male)' },
    { name: 'fable', label: 'Fable (British)' },
    { name: 'onyx', label: 'Onyx (Deep)' },
    { name: 'nova', label: 'Nova (Female)' },
    { name: 'shimmer', label: 'Shimmer (Soft)' },
  ];

  // Audio controls
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

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

  // OpenAI TTS functions
  const generateTTS = async (text: string): Promise<string> => {
    const cacheKey = `${text}-${selectedVoice}`;
    
    // Check cache first
    if (ttsCache.has(cacheKey)) {
      return ttsCache.get(cacheKey)!;
    }

    try {
      setIsGeneratingTTS(true);
      const response = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate TTS');
      }

      const { audioUrl } = await response.json();
      
      // Cache the result
      setTtsCache(prev => new Map(prev).set(cacheKey, audioUrl));
      
      return audioUrl;
    } catch (error) {
      console.error('TTS generation error:', error);
      throw error;
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const speakText = async (text: string, isAutoPlayMode = false): Promise<void> => {
    if (!text.trim()) return;
    
    try {
      const audioUrl = await generateTTS(text);
      
      // Create audio element and play
      const audio = new Audio(audioUrl);
      audio.volume = isMuted ? 0 : volume;
      
      return new Promise((resolve, reject) => {
        audio.onplay = () => setIsTTSPlaying(true);
        audio.onended = () => {
          setIsTTSPlaying(false);
          if (isAutoPlayMode) {
            // Auto-advance to next slide after TTS completes
            setTimeout(() => {
              nextSlide();
            }, 1000); // Small delay for smooth transition
          }
          resolve();
        };
        audio.onerror = () => {
          setIsTTSPlaying(false);
          reject(new Error('Audio playback failed'));
        };
        
        audio.play().catch(reject);
      });
    } catch (error) {
      console.error('Error playing TTS:', error);
      setIsTTSPlaying(false);
      throw error;
    }
  };

  const stopTTS = () => {
    // Stop any playing audio
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    setIsTTSPlaying(false);
  };

  const toggleTTS = async () => {
    if (isTTSPlaying) {
      stopTTS();
    } else {
      const textToSpeak = currentSlide?.caption || storyData?.title || "No text available";
      await speakText(textToSpeak, false); // Manual click, not auto-play mode
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
    } else if (selectedStoryIndex < displayStories.length - 1) {
      // Move to next story
      setSelectedStoryIndex(selectedStoryIndex + 1);
      setCurrentSlideIndex(0);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    } else if (selectedStoryIndex > 0) {
      // Move to previous story
      setSelectedStoryIndex(selectedStoryIndex - 1);
      const prevStoryData = displayStories[selectedStoryIndex - 1]?.data as StorySlideData;
      setCurrentSlideIndex(prevStoryData?.slides?.length - 1 || 0);
    }
  };

  const nextStory = () => {
    if (selectedStoryIndex < displayStories.length - 1) {
      setSelectedStoryIndex(selectedStoryIndex + 1);
      setCurrentSlideIndex(0);
      pauseAudio();
      stopTTS();
    }
  };

  const prevStory = () => {
    if (selectedStoryIndex > 0) {
      setSelectedStoryIndex(selectedStoryIndex - 1);
      setCurrentSlideIndex(0);
      pauseAudio();
      stopTTS();
    }
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
      } else if (currentSlide?.caption || storyData?.title) {
        // If no audio but has text, use TTS with auto-play mode
        const textToSpeak = currentSlide?.caption || storyData?.title;
        if (textToSpeak) {
          speakText(textToSpeak, true).catch(console.error); // Auto-play mode
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
  }, [currentSlideIndex, isAutoPlay, currentSlide?.audioUrl, currentSlide?.caption, storyData?.title, selectedStoryIndex]);


  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === " ") {
        e.preventDefault();
        togglePlayPause();
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        toggleTTS();
      }
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentSlideIndex, slides.length, selectedStoryIndex, stories.length]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (stories.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No Stories Available</h2>
          <p className="text-gray-500 mb-4">Create a story to start viewing, or try our demo stories!</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back to Canvas
            </button>
            <button
              onClick={() => setShowDemo(true)}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
            >
              Try Demo Stories
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-screen bg-black text-white flex flex-col relative"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">{storyData?.title || "Untitled Story"}</h1>
            <p className="text-sm text-gray-400">
              Story {selectedStoryIndex + 1} of {displayStories.length} • Slide {currentSlideIndex + 1} of {slides.length}
              {stories.length === 0 && <span className="ml-2 text-yellow-400">(Demo)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Story Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevStory}
              disabled={selectedStoryIndex === 0}
              className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm px-2">{selectedStoryIndex + 1}/{displayStories.length}</span>
            <button
              onClick={nextStory}
              disabled={selectedStoryIndex === displayStories.length - 1}
              className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Auto-play Toggle */}
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
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="text-xs rounded border px-2 py-1 bg-black text-white border-gray-600"
          >
            {availableVoices.map((voice) => (
              <option key={voice.name} value={voice.name}>
                🎤 {voice.label}
              </option>
            ))}
          </select>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <BookOpen className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Story Display */}
      <div className="flex-1 flex items-center justify-center relative">
        {currentSlide?.imageUrl ? (
          <img
            src={currentSlide.imageUrl}
            alt={currentSlide.caption || `Slide ${currentSlideIndex + 1}`}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <img
            src="/tl.png"
            alt="Default story slide"
            className="max-w-full max-h-full object-contain"
          />
        )}

        {/* Slide Caption Overlay */}
        {currentSlide?.caption && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-6">
            <p className="text-lg text-center">{currentSlide.caption}</p>
          </div>
        )}

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          disabled={currentSlideIndex === 0 && selectedStoryIndex === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full"
        >
          <SkipBack className="h-6 w-6" />
        </button>
        <button
          onClick={nextSlide}
          disabled={currentSlideIndex === slides.length - 1 && selectedStoryIndex === displayStories.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full"
        >
          <SkipForward className="h-6 w-6" />
        </button>

        {/* Audio Controls Overlay */}
        <div className="absolute top-4 right-4 flex gap-2">
          {/* TTS Controls - Always visible if there's text to read */}
          {(currentSlide?.caption || storyData?.title) && (
            <button
              onClick={toggleTTS}
              disabled={isGeneratingTTS}
              className="p-3 bg-black/70 hover:bg-black/90 rounded-full transition-colors relative group disabled:opacity-50 disabled:cursor-not-allowed"
              title={isTTSPlaying ? "Stop OpenAI TTS narration" : isGeneratingTTS ? "Generating audio..." : "Read text aloud with OpenAI TTS"}
            >
              {isGeneratingTTS ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isTTSPlaying ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
              {/* Quality indicator */}
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          )}
          
          {/* Audio Controls - Only show if audio is uploaded */}
          {currentSlide?.audioUrl && (
            <>
              <button
                onClick={togglePlayPause}
                className="p-3 bg-black/70 hover:bg-black/90 rounded-full transition-colors"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-3 bg-black/70 hover:bg-black/90 rounded-full transition-colors"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
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

      {/* Bottom Navigation */}
      <div className="p-4 bg-black/80 backdrop-blur-sm">
        {/* Slide Thumbnails */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={cn(
                "flex-shrink-0 w-16 h-12 rounded border-2 cursor-pointer transition-colors",
                index === currentSlideIndex 
                  ? "border-white bg-white/20" 
                  : "border-gray-600 hover:border-gray-400"
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
                <img
                  src="/tl.png"
                  alt="Default story slide"
                  className="w-full h-full object-cover rounded"
                />
              )}
            </div>
          ))}
        </div>

        {/* Story Thumbnails */}
        {displayStories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {displayStories.map((story, index) => {
              const storyData = story.data as StorySlideData;
              const firstSlide = storyData?.slides?.[0];
              return (
                <div
                  key={story.id}
                  className={cn(
                    "flex-shrink-0 w-20 h-12 rounded border-2 cursor-pointer transition-colors",
                    index === selectedStoryIndex 
                      ? "border-white bg-white/20" 
                      : "border-gray-600 hover:border-gray-400"
                  )}
                  onClick={() => {
                    setSelectedStoryIndex(index);
                    setCurrentSlideIndex(0);
                  }}
                >
                  {firstSlide?.imageUrl ? (
                    <img
                      src={firstSlide.imageUrl}
                      alt={storyData?.title || `Story ${index + 1}`}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <img
                      src="/tl.png"
                      alt="Default story slide"
                      className="w-full h-full object-cover rounded"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default StoryView;

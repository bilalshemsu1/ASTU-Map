'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  MapPin,
  CornerUpRight,
  Loader2,
  RotateCcw,
  DoorOpen,
  Info,
  BookOpen,
  Utensils,
  Laptop,
  Building2,
  Trophy,
  GraduationCap,
  LocateFixed,
  Search,
} from 'lucide-react';
import { CampusData, Building, Room } from '../lib/types/map';
import { SuggestedPlace, AIChatResponse } from '../lib/utils/aiAssistant';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedPlaces?: SuggestedPlace[];
  timestamp: Date;
}

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  campusData: CampusData;
  onSelectPlace: (building: Building) => void;
  onStartDirections: (
    building: Building,
    room?: Room,
    originChoice?: 'ask' | 'gps' | 'main_gate' | 'oda_gate'
  ) => void;
}

const QUICK_PROMPTS = [
  { icon: BookOpen, label: 'Central Library', query: 'Where is the Central Library?' },
  { icon: Utensils, label: 'Students Cafe', query: 'Where can I find food or the student cafeteria?' },
  { icon: Laptop, label: 'Computing & EE', query: 'Where is the School of Electrical Engineering & Computing?' },
  { icon: Building2, label: 'Administration', query: 'Where is the Administration Building?' },
  { icon: Trophy, label: 'Sports & Stadium', query: 'Where are the stadium and basketball courts?' },
  { icon: GraduationCap, label: 'Freshman Dorms', query: 'Where are the freshman dormitories and programs?' },
];

/**
 * Inline text formatter for bold, code, and italic tokens.
 */
function renderInlineFormatted(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\*[^*\n]+?\*)/g);
  return tokens.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={index} className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-blue-700">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={index} className="italic text-slate-700">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

/**
 * Renders assistant messages with proper markdown paragraphs, lists, and callout blocks.
 */
function FormattedMessage({ content }: { content: string }) {
  const normalized = content.replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);

  return (
    <div className="space-y-2.5 text-xs sm:text-[13px] leading-relaxed text-slate-800">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Blockquote / Tip / Note
        if (trimmed.startsWith('>')) {
          const quoteText = trimmed
            .split('\n')
            .map((line) => line.replace(/^>\s?/, ''))
            .join(' ');
          return (
            <div
              key={bIdx}
              className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/70 text-blue-900 text-[11px] sm:text-xs flex items-start gap-2 shadow-2xs my-1.5"
            >
              <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="leading-snug">{renderInlineFormatted(quoteText)}</div>
            </div>
          );
        }

        // Check if block is a bulleted or numbered list
        const lines = trimmed.split('\n');
        const isList = lines.every((line) => /^(\s*[-*•]|\s*\d+\.)/.test(line.trim()));

        if (isList) {
          return (
            <ul key={bIdx} className="space-y-1.5 my-1.5 pl-0.5">
              {lines.map((line, lIdx) => {
                const itemText = line.replace(/^(\s*[-*•]|\s*\d+\.)\s*/, '');
                return (
                  <li key={lIdx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 mt-2" />
                    <span className="flex-1 leading-relaxed">{renderInlineFormatted(itemText)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Regular paragraph (handles inline breaks)
        return (
          <p key={bIdx} className="leading-relaxed">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInlineFormatted(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function getCategoryBadge(category?: string) {
  switch (category) {
    case 'academic':
      return { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' };
    case 'library':
      return { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' };
    case 'dining':
    case 'services':
      return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' };
    case 'dormitory':
      return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' };
    case 'sports':
      return { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' };
    default:
      return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
  }
}

export default function AIAssistantModal({
  isOpen,
  onClose,
  campusData,
  onSelectPlace,
  onStartDirections,
}: AIAssistantModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [targetForDirections, setTargetForDirections] = useState<{
    building: Building;
    room?: Room;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = (await res.json()) as AIChatResponse;

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Here is what I found on the campus map.',
        suggestedPlaces: data.suggestedPlaces,
        timestamp: new Date(),
      };

      setMessages([...newMessages, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content:
          "I am having a brief issue connecting to the AI service. You can still search for any building using the top search bar.",
        timestamp: new Date(),
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceAction = (place: SuggestedPlace, action: 'view' | 'directions') => {
    const building = campusData.buildings.find(
      (b) =>
        b.id.toLowerCase() === place.buildingId.toLowerCase() ||
        b.code.toLowerCase() === place.buildingCode?.toLowerCase() ||
        b.name.toLowerCase() === place.buildingName.toLowerCase()
    );

    if (!building) return;

    let targetRoom: Room | undefined = undefined;
    if (place.roomName && building.rooms) {
      targetRoom = building.rooms.find(
        (r) =>
          r.name.toLowerCase() === place.roomName?.toLowerCase() ||
          r.name.toLowerCase().includes(place.roomName?.toLowerCase() || '')
      );
    }

    if (action === 'view') {
      onSelectPlace(building);
      onClose();
    } else {
      // Prompt user to pick their starting origin point
      setTargetForDirections({ building, room: targetRoom });
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-stretch justify-center sm:justify-end sm:p-4 pointer-events-none">
      {/* Dark backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity sm:bg-black/15 pointer-events-auto"
      />

      {/* Main Chat Drawer / Docked Card */}
      <div className="relative w-full sm:w-[420px] h-[82vh] sm:h-full max-h-[92vh] sm:max-h-none bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200/90 flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-right-6 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between shadow-xs flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide text-white">AI Assistant</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  ASTU
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Reset Conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
          {/* Quick Questions when empty */}
          {messages.length === 0 && (
            <div className="py-2 space-y-2.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                Suggested Questions
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((prompt, idx) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt.query)}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-blue-400 rounded-xl text-left transition-all shadow-2xs group cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                          {prompt.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-2 mt-2 leading-snug">
                        {prompt.query}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                  msg.role === 'user'
                    ? 'max-w-[85%] bg-slate-900 text-white rounded-br-xs font-medium'
                    : 'w-full bg-white text-slate-800 border border-slate-200/80 rounded-2xl'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <FormattedMessage content={msg.content} />
                )}

                {/* Suggested Place Interactive Cards */}
                {msg.suggestedPlaces && msg.suggestedPlaces.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-blue-600" />
                      Suggested Locations
                    </p>
                    {msg.suggestedPlaces.map((place, pIdx) => {
                      const buildingObj = campusData.buildings.find(
                        (b) => b.id.toLowerCase() === place.buildingId.toLowerCase()
                      );
                      const badge = getCategoryBadge(buildingObj?.category);

                      return (
                        <div
                          key={pIdx}
                          className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 transition-all hover:border-blue-300 hover:shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded-md font-black text-[10px] ${badge.bg} ${badge.text} border ${badge.border}`}>
                                  {place.buildingCode || 'ASTU'}
                                </span>
                                <span className="font-bold text-slate-900 text-xs">
                                  {place.buildingName}
                                </span>
                              </div>
                              {place.roomName && (
                                <p className="text-[11px] text-slate-700 mt-1 flex items-center gap-1.5 font-medium">
                                  <DoorOpen className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                  <span>{place.roomName}</span>
                                </p>
                              )}
                              {place.reason && (
                                <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                                  {place.reason}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Direct Action Triggers */}
                          <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center gap-2">
                            <button
                              onClick={() => handlePlaceAction(place, 'view')}
                              className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-blue-700 font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                            >
                              <MapPin className="w-3 h-3 text-blue-600" />
                              View on Map
                            </button>
                            <button
                              onClick={() => handlePlaceAction(place, 'directions')}
                              className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                            >
                              <CornerUpRight className="w-3 h-3" />
                              Get Directions
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-xs p-3.5 shadow-xs flex items-center gap-2 text-slate-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Searching ASTU campus directory...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200/80 flex-shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything about ASTU (e.g. where is B7?)..."
              disabled={isLoading}
              className="flex-1 bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed flex-shrink-0 active:scale-95"
              title="Send Message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>

        {/* STARTING POINT SELECTOR OVERLAY */}
        {targetForDirections && (
          <div className="absolute inset-0 bg-white z-40 flex flex-col animate-in fade-in duration-150">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">Choose Starting Point</h4>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[280px]">
                  Directions to {targetForDirections.building.name}
                </p>
              </div>
              <button
                onClick={() => setTargetForDirections(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options List */}
            <div className="p-4 space-y-2.5 flex-1 overflow-y-auto bg-slate-50/70">
              {/* Option 1: Live GPS */}
              <button
                onClick={() => {
                  onStartDirections(targetForDirections.building, targetForDirections.room, 'gps');
                  setTargetForDirections(null);
                  onClose();
                }}
                className="w-full p-3.5 bg-blue-50/80 hover:bg-blue-100/90 border border-blue-200/90 rounded-xl text-left transition-all flex items-center gap-3.5 group cursor-pointer shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <LocateFixed className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-blue-950">My Live Location (GPS)</div>
                  <p className="text-[11px] text-blue-700/80 mt-0.5">
                    Start walking route from where you are right now
                  </p>
                </div>
              </button>

              {/* Option 2: Search any Building / Room */}
              <button
                onClick={() => {
                  onStartDirections(targetForDirections.building, targetForDirections.room, 'ask');
                  setTargetForDirections(null);
                  onClose();
                }}
                className="w-full p-3.5 bg-white hover:bg-slate-100 border border-slate-200/90 rounded-xl text-left transition-all flex items-center gap-3.5 group cursor-pointer shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                  <Search className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900">Choose a Building or Dormitory...</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select your dorm, block, or type any campus location
                  </p>
                </div>
              </button>

              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
                  Campus Entrance Gates
                </p>

                {/* Option 3: Main Gate */}
                <button
                  onClick={() => {
                    onStartDirections(targetForDirections.building, targetForDirections.room, 'main_gate');
                    setTargetForDirections(null);
                    onClose();
                  }}
                  className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-left transition-all flex items-center gap-3 group cursor-pointer mb-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800">ASTU Main Gate</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Main entrance on the highway</p>
                  </div>
                </button>

                {/* Option 4: Oda Gateway */}
                <button
                  onClick={() => {
                    onStartDirections(targetForDirections.building, targetForDirections.room, 'oda_gate');
                    setTargetForDirections(null);
                    onClose();
                  }}
                  className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-left transition-all flex items-center gap-3 group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800">Oda Gateway</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">South campus entrance gate</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

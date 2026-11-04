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
  ChevronRight,
  Clock,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { CampusData, Building, Room } from '../lib/types/map';
import { SuggestedPlace, AIChatResponse } from '../lib/utils/aiAssistant';
import { getFacilityOperatingStatus } from '../lib/utils/operatingHours';

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
  { icon: Laptop, label: 'SOEEC & Computing', query: 'Where is the School of Electrical Engineering & Computing?' },
  { icon: BookOpen, label: 'Central Library', query: 'Where is the Central Library and what are its study halls?' },
  { icon: Utensils, label: 'Students Cafeteria', query: 'Where can I find food or the student cafeteria?' },
  { icon: Building2, label: 'Registrar & Admin', query: 'Where is the New Administration Building for transcripts?' },
  { icon: Trophy, label: 'Sports Stadium', query: 'Where are the ASTU stadium and tennis courts?' },
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
    <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-slate-700">
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
              className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-900 text-xs flex items-start gap-2 my-1"
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
            <ul key={bIdx} className="space-y-1.5 my-1 pl-1">
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
          'I am currently operating in offline mode. You can still search for any building or room using the top search bar.',
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
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center sm:justify-end sm:p-5 pointer-events-none">
      {/* Refined frosted backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/30 backdrop-blur-xs transition-opacity pointer-events-auto"
      />

      {/* Main Intelligent Copilot Card */}
      <div className="relative w-full sm:w-[440px] h-[86vh] sm:h-[88vh] max-h-[820px] bg-white sm:rounded-2xl rounded-t-[28px] shadow-[0_20px_50px_rgba(15,23,42,0.22)] border border-slate-200/90 flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-5 sm:slide-in-from-right-5 duration-200">
        
        {/* Sleek Copilot Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-xs text-slate-900 tracking-tight">ASTU Campus Copilot</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                25 Buildings • 133 Multi-Floor Rooms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              title="Close Copilot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          
          {/* Empty State: Intelligent Quick Intent Chips */}
          {messages.length === 0 && (
            <div className="py-2 space-y-3">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs mb-1">
                  <Compass className="w-4 h-4 text-blue-600" />
                  <span>How can I assist your campus navigation?</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Ask in plain language for classrooms, faculty departments, dining menus, sports facilities, or directions across ASTU.
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                  Quick Prompts
                </p>
                <div className="flex flex-col gap-1.5">
                  {QUICK_PROMPTS.map((prompt, idx) => {
                    const Icon = prompt.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(prompt.query)}
                        className="p-2.5 bg-white hover:bg-blue-50/50 hover:border-blue-200 border border-slate-200/80 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 text-slate-600 flex items-center justify-center flex-shrink-0 transition-colors">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                            {prompt.label}
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Chat Stream Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-2xl p-3 text-xs sm:text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'max-w-[85%] bg-slate-900 text-white rounded-br-xs font-medium shadow-sm'
                    : 'w-full bg-white text-slate-800 border border-slate-200/80 shadow-xs'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <FormattedMessage content={msg.content} />
                )}

                {/* Rich Campus Venue Spotlight Cards */}
                {msg.suggestedPlaces && msg.suggestedPlaces.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-blue-600" />
                      Identified Locations
                    </p>

                    {msg.suggestedPlaces.map((place, pIdx) => {
                      const buildingObj = campusData.buildings.find(
                        (b) =>
                          b.id.toLowerCase() === place.buildingId.toLowerCase() ||
                          b.code.toLowerCase() === place.buildingCode?.toLowerCase()
                      );
                      const opStatus = buildingObj ? getFacilityOperatingStatus(buildingObj) : null;
                      const placeImage = buildingObj?.details?.images?.[0];

                      return (
                        <div
                          key={pIdx}
                          className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 transition-all hover:border-blue-300 hover:bg-blue-50/30"
                        >
                          <div className="flex items-start gap-2.5">
                            {placeImage && (
                              <img
                                src={placeImage}
                                alt={place.buildingName}
                                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                              />
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.2 rounded font-black text-[10px] bg-slate-200 text-slate-800">
                                  {place.buildingCode || buildingObj?.code || 'ASTU'}
                                </span>
                                <span className="font-bold text-slate-900 text-xs truncate">
                                  {place.buildingName}
                                </span>
                                {opStatus && (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1 ${opStatus.badgeBg} ${opStatus.badgeColor}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        opStatus.status === 'open' || opStatus.status === 'open_24_7'
                                          ? 'bg-emerald-500'
                                          : opStatus.status === 'closing_soon' || opStatus.status === 'lunch_break'
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                      }`}
                                    />
                                    {opStatus.badgeLabel}
                                  </span>
                                )}
                              </div>

                              {place.roomName && (
                                <p className="text-[11px] text-blue-700 mt-1 flex items-center gap-1 font-semibold">
                                  <DoorOpen className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                  <span>{place.roomName}</span>
                                </p>
                              )}

                              {place.reason && (
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                                  {place.reason}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePlaceAction(place, 'view')}
                              className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span>Show on Map</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePlaceAction(place, 'directions')}
                              className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                            >
                              <CornerUpRight className="w-3 h-3" />
                              <span>Directions</span>
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

          {/* Assistant Loading Skeleton */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-xs p-3 shadow-xs flex items-center gap-2 text-slate-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="font-medium">Searching ASTU knowledge catalog...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Refined Command Palette Input Bar */}
        <div className="p-3 bg-white border-t border-slate-100 flex-shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about rooms, facilities, or hours..."
                disabled={isLoading}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-xl pl-3.5 pr-2 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed flex-shrink-0 active:scale-95"
              title="Send Prompt"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1 font-medium">
            <span>Powered by ASTU Campus Intelligence</span>
            <span className="hidden sm:inline">Press Esc to exit</span>
          </div>
        </div>

        {/* STARTING POINT ORIGIN SELECTOR OVERLAY */}
        {targetForDirections && (
          <div className="absolute inset-0 bg-white z-40 flex flex-col animate-in fade-in duration-150">
            {/* Header */}
            <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900">Select Starting Point</h4>
                <p className="text-[11px] text-slate-500 truncate max-w-[280px]">
                  Navigating to {targetForDirections.building.name}
                  {targetForDirections.room ? ` • ${targetForDirections.room.name}` : ''}
                </p>
              </div>
              <button
                onClick={() => setTargetForDirections(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options List */}
            <div className="p-4 space-y-2 flex-1 overflow-y-auto bg-slate-50/50">
              {/* Option 1: Live GPS */}
              <button
                type="button"
                onClick={() => {
                  onStartDirections(targetForDirections.building, targetForDirections.room, 'gps');
                  setTargetForDirections(null);
                  onClose();
                }}
                className="w-full p-3 bg-white hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-300 rounded-xl text-left transition-all flex items-center gap-3 group cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <LocateFixed className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900">My Live GPS Location</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Start route from current physical location
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </button>

              {/* Option 2: Choose any other building */}
              <button
                type="button"
                onClick={() => {
                  onStartDirections(targetForDirections.building, targetForDirections.room, 'ask');
                  setTargetForDirections(null);
                  onClose();
                }}
                className="w-full p-3 bg-white hover:bg-slate-100 border border-slate-200/90 rounded-xl text-left transition-all flex items-center gap-3 group cursor-pointer shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Search className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900">Choose Another Campus Location...</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select a dormitory, block, or search venue
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-700 transition-colors" />
              </button>

              <div className="pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
                  Campus Perimeter Gates
                </p>

                {/* Option 3: Main Gate */}
                <button
                  type="button"
                  onClick={() => {
                    onStartDirections(targetForDirections.building, targetForDirections.room, 'main_gate');
                    setTargetForDirections(null);
                    onClose();
                  }}
                  className="w-full p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-left transition-all flex items-center gap-2.5 group cursor-pointer mb-1.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <DoorOpen className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800">ASTU Main Gate</div>
                    <p className="text-[10px] text-slate-400">Main entrance from highway</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-700 transition-colors" />
                </button>

                {/* Option 4: Oda Gateway */}
                <button
                  type="button"
                  onClick={() => {
                    onStartDirections(targetForDirections.building, targetForDirections.room, 'oda_gate');
                    setTargetForDirections(null);
                    onClose();
                  }}
                  className="w-full p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-left transition-all flex items-center gap-2.5 group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
                    <DoorOpen className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800">Oda Gateway</div>
                    <p className="text-[10px] text-slate-400">South campus entrance</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-700 transition-colors" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  Download,
  Share2,
  QrCode,
  ExternalLink,
  DoorOpen,
  MapPin,
  Send,
  Navigation,
  Smartphone,
} from 'lucide-react';
import { Building, Room, RouteResult } from '../lib/types/map';
import { getFacilityOperatingStatus } from '../lib/utils/operatingHours';

interface CampusShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  building?: Building | null;
  room?: Room | null;
  routeResult?: RouteResult | null;
  startLabel?: string;
  destLabel?: string;
}

export default function CampusShareModal({
  isOpen,
  onClose,
  building,
  room,
  routeResult,
  startLabel,
  destLabel,
}: CampusShareModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'link'>('qr');
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compute the exact deep link URL
  const shareUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;

    if (routeResult && startLabel && destLabel) {
      return `${origin}${pathname}?start=${encodeURIComponent(startLabel)}&dest=${encodeURIComponent(destLabel)}`;
    }

    if (building) {
      const roomParam = room ? `&room=${encodeURIComponent(room.id)}` : '';
      return `${origin}${pathname}?place=${encodeURIComponent(building.id)}${roomParam}`;
    }

    return `${origin}${pathname}`;
  }, [building, room, routeResult, startLabel, destLabel]);

  // Generate crisp QR code on URL change
  useEffect(() => {
    if (!shareUrl) return;

    QRCode.toDataURL(shareUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a', // Slate 900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [shareUrl]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Copy to clipboard handler
  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Download QR image
  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    const filename = building
      ? `ASTU_${building.code}${room ? `_${room.name}` : ''}_QR.png`
      : 'ASTU_Campus_Location_QR.png';
    link.download = filename.replace(/\s+/g, '_');
    link.href = qrDataUrl;
    link.click();
  };

  // Social share shortcuts
  const handleShareTelegram = () => {
    const text = building
      ? `Check out ${building.name} on ASTU Campus Map!`
      : `Check out this walking route on ASTU Campus Map!`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareWhatsApp = () => {
    const text = building
      ? `Check out ${building.name} on ASTU Campus Map: ${shareUrl}`
      : `Check out this route on ASTU Campus Map: ${shareUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: building ? `${building.name} | ASTU Map` : 'ASTU Campus Map Route',
        text: `Explore ${building?.name || 'ASTU Campus'} with live walking wayfinding!`,
        url: shareUrl,
      }).catch(() => {});
    }
  };

  if (!isOpen) return null;

  const opStatus = building ? getFacilityOperatingStatus(building) : null;
  const isNativeShareSupported = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 pointer-events-none animate-in fade-in duration-200">
      {/* Frosted Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity pointer-events-auto"
      />

      {/* Main Built-in Share Card */}
      <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-[0_24px_60px_-12px_rgba(15,23,42,0.28)] border border-slate-200/90 overflow-hidden pointer-events-auto flex flex-col z-10 animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                Share & Scan Location
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Transfer to mobile or send to friends
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
          
          {/* Target Location Snippet */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
            {building?.details?.images?.[0] ? (
              <img
                src={building.details.images[0]}
                alt={building.name}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-slate-200 shadow-2xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 font-black text-xs">
                {building?.code || 'ASTU'}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {building && (
                  <span className="px-1.5 py-0.2 rounded font-black text-[10px] bg-slate-200 text-slate-800">
                    {building.code}
                  </span>
                )}
                {opStatus && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1 ${opStatus.badgeBg} ${opStatus.badgeColor}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        opStatus.status === 'open' || opStatus.status === 'open_24_7'
                          ? 'bg-emerald-500'
                          : 'bg-rose-500'
                      }`}
                    />
                    {opStatus.badgeLabel}
                  </span>
                )}
              </div>

              <h4 className="font-extrabold text-xs text-slate-900 truncate mt-0.5">
                {building ? building.name : destLabel ? `Route to ${destLabel}` : 'ASTU Campus Location'}
              </h4>

              {room && (
                <p className="text-[11px] text-blue-700 font-semibold flex items-center gap-1 mt-0.5">
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>{room.name} {room.floor !== undefined ? `(Floor ${room.floor})` : ''}</span>
                </p>
              )}

              {routeResult && (
                <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                  <Navigation className="w-3.5 h-3.5 text-blue-600" />
                  <span>{startLabel} → {destLabel}</span>
                </p>
              )}
            </div>
          </div>

          {/* QR Code Presentation Box */}
          <div className="flex flex-col items-center justify-center bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 text-center">
            {qrDataUrl ? (
              <div className="relative p-2.5 bg-white rounded-2xl shadow-sm border border-slate-200/90 group">
                <img
                  src={qrDataUrl}
                  alt="Campus Location QR Code"
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-xl"
                />
                {/* Center Badge Accent */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md border-2 border-white pointer-events-none">
                  <MapPin className="w-4 h-4 fill-white" />
                </div>
              </div>
            ) : (
              <div className="w-48 h-48 bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                Generating QR...
              </div>
            )}

            <div className="mt-3 flex items-center gap-1.5 text-slate-700 text-xs font-semibold">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span>Scan with phone camera to open on mobile</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Works instantly on iOS Camera, Google Lens, and Android scanners
            </p>
          </div>

          {/* Quick Copy Link Box */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-slate-100/80 border border-slate-200 text-slate-600 text-[11px] font-mono rounded-xl px-3 py-2 outline-none select-all truncate"
              />
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Action Button Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Download QR Image for Print/Flyers */}
            <button
              type="button"
              onClick={handleDownloadQR}
              className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download QR</span>
            </button>

            {/* Telegram Share (Prime ASTU campus channel) */}
            <button
              type="button"
              onClick={handleShareTelegram}
              className="py-2.5 px-3 bg-[#24A1DE] hover:bg-[#1f8fc5] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram</span>
            </button>

            {/* WhatsApp Share */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2.5 px-3 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            {/* Native Share (if supported) or Direct Link */}
            {isNativeShareSupported ? (
              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>More Apps...</span>
              </button>
            ) : (
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Open in Tab</span>
              </a>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <span>ASTU Smart Wayfinding Link</span>
          <span>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}

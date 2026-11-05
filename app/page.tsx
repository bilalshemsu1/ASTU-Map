'use client';

import React, { useState } from 'react';
import { CampusData } from '../lib/types/map';
import initialCampusData from '../lib/data/campus.json';
import GoogleMapsUI from '../components/GoogleMapsUI';

export default function Home() {
  const [campusData] = useState<CampusData>(initialCampusData as CampusData);

  return (
    <main className="fixed inset-0 w-full h-full h-[100dvh] overflow-hidden select-none">
      <GoogleMapsUI campusData={campusData} />
    </main>
  );
}
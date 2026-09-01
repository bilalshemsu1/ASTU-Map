'use client';

import React, { useState } from 'react';
import { CampusData } from '../lib/types/map';
import initialCampusData from '../lib/data/campus.json';
import GoogleMapsUI from '../components/GoogleMapsUI';

export default function Home() {
  const [campusData] = useState<CampusData>(initialCampusData as CampusData);

  return (
    <main className="w-screen h-screen overflow-hidden">
      <GoogleMapsUI campusData={campusData} />
    </main>
  );
}
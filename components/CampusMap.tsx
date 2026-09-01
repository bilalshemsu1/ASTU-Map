"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/types";

const CampusMapInner = dynamic(
  () => import("./CampusMapInner"),
  { ssr: false, loading: () => <div className="fixed inset-0 bg-[#E8EAED]" /> },
);

export type CampusMapProps = {
  route?: LatLng[];
  startPoint?: LatLng;
  endPoint?: LatLng;
  picking?: boolean;
  highlightPoiId?: string;
  onPickPoint?: (p: LatLng) => void;
};

export default function CampusMap(props: CampusMapProps) {
  return <CampusMapInner {...props} />;
}
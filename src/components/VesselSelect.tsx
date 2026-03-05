'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function VesselSelect({
  vessels,
  value,
  segment,
}: {
  vessels: { id: string; name: string }[];
  value: string | undefined;
  segment: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  return (
    <select
      className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white"
      value={value ?? ''}
      onChange={(e) => {
        const vesselId = e.currentTarget.value;
        const params = new URLSearchParams(sp.toString());
        params.set('vesselId', vesselId);
        params.set('segment', segment);
        router.push(`/tasks?${params.toString()}`);
      }}
    >
      {vessels.map((v) => (
        <option key={v.id} value={v.id} className="text-black">
          {v.name}
        </option>
      ))}
    </select>
  );
}

"use client";

import { useState } from "react";
import { useHaulerStore } from "@/lib/store";

export function MissionForm() {
  const addMission = useHaulerStore((s) => s.addMission);
  const [form, setForm] = useState({
    pickup: "",
    dropoff: "",
    reward: "",
    scu: "",
    corporation: "Covalex",
    availableMinutes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pickup || !form.dropoff || !form.reward || !form.scu) return;

    addMission({
      pickup: form.pickup.trim(),
      dropoff: form.dropoff.trim(),
      reward: Number(form.reward),
      scu: Number(form.scu),
      corporation: form.corporation,
      availableMinutes: form.availableMinutes ? Number(form.availableMinutes) : undefined,
    });

    setForm({ pickup: "", dropoff: "", reward: "", scu: "", corporation: "Covalex", availableMinutes: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-elevated bg-elevated/30 p-4 space-y-3">
      <h3 className="text-sm font-medium uppercase tracking-wider text-accent/60">
        Add Mission
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Pickup"
          value={form.pickup}
          onChange={(e) => setForm({ ...form, pickup: e.target.value })}
          className="rounded bg-ink border border-elevated px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Dropoff"
          value={form.dropoff}
          onChange={(e) => setForm({ ...form, dropoff: e.target.value })}
          className="rounded bg-ink border border-elevated px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Reward (aUEC)"
          value={form.reward}
          onChange={(e) => setForm({ ...form, reward: e.target.value })}
          className="rounded bg-ink border border-elevated px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          placeholder="SCU"
          value={form.scu}
          onChange={(e) => setForm({ ...form, scu: e.target.value })}
          className="rounded bg-ink border border-elevated px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={form.corporation}
          onChange={(e) => setForm({ ...form, corporation: e.target.value })}
          className="rounded bg-ink border border-elevated px-2 py-1.5 text-sm"
        >
          <option>Covalex</option>
          <option>Ling Family</option>
          <option>Red Wind</option>
        </select>
        <input
          type="number"
          placeholder="Time left (min)"
          value={form.availableMinutes}
          onChange={(e) => setForm({ ...form, availableMinutes: e.target.value })}
          className="rounded bg-ink border border-elevated px-2 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded bg-gold/90 hover:bg-gold text-ink font-medium py-2 text-sm transition"
      >
        Add Mission
      </button>
    </form>
  );
}
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Type,
  Users,
  X,
} from 'lucide-react';
import { supabase } from './lib/supabase';

export const FAMILY_MEMBERS = [
  'Tom',
  'Kandi',
  'Faith',
  'Granger',
  'Amy',
  'Charlie',
  'Betty',
  'Robert',
] as const;

export type FamilyMember = (typeof FAMILY_MEMBERS)[number];
type MemberFilter = 'all' | FamilyMember;

interface MemberStyle {
  pill: string;
  badge: string;
  border: string;
}

const FALLBACK_STYLE: MemberStyle = {
  pill: 'bg-slate-100 text-slate-900 border-slate-300',
  badge: 'bg-slate-700 text-white border-slate-800',
  border: 'border-l-slate-600',
};

export const MEMBER_STYLES: Record<FamilyMember, MemberStyle> = {
  Tom: {
    pill: 'bg-sky-100 text-sky-900 border-sky-300',
    badge: 'bg-sky-600 text-white border-sky-700',
    border: 'border-l-sky-600',
  },
  Kandi: {
    pill: 'bg-rose-100 text-rose-900 border-rose-300',
    badge: 'bg-rose-600 text-white border-rose-700',
    border: 'border-l-rose-600',
  },
  Faith: {
    pill: 'bg-purple-100 text-purple-900 border-purple-300',
    badge: 'bg-purple-600 text-white border-purple-700',
    border: 'border-l-purple-600',
  },
  Granger: {
    pill: 'bg-amber-100 text-amber-900 border-amber-300',
    badge: 'bg-amber-600 text-white border-amber-700',
    border: 'border-l-amber-600',
  },
  Amy: {
    pill: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    badge: 'bg-emerald-600 text-white border-emerald-700',
    border: 'border-l-emerald-600',
  },
  Charlie: {
    pill: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    badge: 'bg-indigo-600 text-white border-indigo-700',
    border: 'border-l-indigo-600',
  },
  Betty: {
    pill: 'bg-teal-100 text-teal-900 border-teal-300',
    badge: 'bg-teal-600 text-white border-teal-700',
    border: 'border-l-teal-600',
  },
  Robert: {
    pill: 'bg-orange-100 text-orange-900 border-orange-300',
    badge: 'bg-orange-600 text-white border-orange-700',
    border: 'border-l-orange-600',
  },
};

interface Appointment {
  id: string;
  title: string;
  member: string;
  date: string;
  time: string;
  location: string;
  notes?: string | null;
  created_at?: string;
}

interface OverlapMatch {
  appointment: Appointment;
  reasons: string[];
}

function normalizeTime(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getOverlapMatches(
  candidate: {
    id?: string | null;
    member: string;
    date: string;
    time: string;
  },
  allAppointments: Appointment[]
): OverlapMatch[] {
  if (!candidate.date) return [];

  const candidateTime = normalizeTime(candidate.time);
  const matches: OverlapMatch[] = [];

  for (const existing of allAppointments) {
    if (candidate.id && existing.id === candidate.id) continue;
    if (existing.date !== candidate.date) continue;

    const existingTime = normalizeTime(existing.time);
    const sameSpecificTime =
      candidateTime !== '' &&
      candidateTime !== 'all day' &&
      candidateTime === existingTime;
    const samePersonSameDate = existing.member === candidate.member;

    if (samePersonSameDate || sameSpecificTime) {
      const reasons: string[] = [`same date (${existing.date})`];
      if (samePersonSameDate) {
        reasons.push(`same person (${existing.member})`);
      }
      if (sameSpecificTime) {
        reasons.push(`same time (${existing.time})`);
      }
      matches.push({ appointment: existing, reasons });
    }
  }

  return matches;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function App() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberFilter>('all');
  const [largePrint, setLargePrint] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [member, setMember] = useState<FamilyMember>('Charlie');
  const [date, setDate] = useState<string>(() => getTodayIsoDate());
  const [time, setTime] = useState('10:00 AM');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState<boolean>(false);

  // Tracks the conflict signature the user explicitly dismissed so changing date/time/member re-triggers it
  const [dismissedConflictKey, setDismissedConflictKey] = useState<string | null>(null);
  const [dismissedCardIds, setDismissedCardIds] = useState<Record<string, boolean>>({});

  async function fetchAppointments() {
    setErrorMsg(null);
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Supabase fetch error:', error);
      setErrorMsg(error.message);
    } else {
      setAppointments((data as Appointment[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchAppointments();

    const channel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          void fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  function resetForm() {
    setTitle('');
    setMember('Charlie');
    setDate(getTodayIsoDate());
    setTime('10:00 AM');
    setLocation('');
    setNotes('');
    setEditingId(null);
    setDismissedConflictKey(null);
    setShowForm(false);
  }

  function startNewAppointment() {
    resetForm();
    setShowForm(true);
  }

  function startEditAppointment(appt: Appointment) {
    setEditingId(appt.id);
    setTitle(appt.title);
    setMember(
      FAMILY_MEMBERS.includes(appt.member as FamilyMember)
        ? (appt.member as FamilyMember)
        : 'Charlie'
    );
    setDate(appt.date);
    setTime(appt.time);
    setLocation(appt.location === 'TBD' ? '' : appt.location);
    setNotes(appt.notes ?? '');
    setDismissedConflictKey(null);
    setShowForm(true);
  }

  const formOverlaps = showForm
    ? getOverlapMatches(
        { id: editingId, member, date, time: time.trim() || 'All Day' },
        appointments
      )
    : [];

  const currentConflictKey =
    formOverlaps.length > 0
      ? `${date}|${normalizeTime(time)}|${member}|${formOverlaps
          .map((m) => m.appointment.id)
          .sort()
          .join(',')}`
      : null;

  const isFormConflictDismissed =
    currentConflictKey !== null && dismissedConflictKey === currentConflictKey;

  async function handleSaveAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date.trim()) return;

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      title: title.trim(),
      member,
      date,
      time: time.trim() || 'All Day',
      location: location.trim() || 'TBD',
      notes: notes.trim() || null,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('appointments')
        .update(payload)
        .eq('id', editingId)
        .select();

      setSaving(false);

      if (error) {
        console.error('Supabase update error:', error);
        setErrorMsg(error.message);
        return;
      }

      if (data && data.length > 0) {
        const updated = data[0] as Appointment;
        setAppointments((prev) =>
          prev.map((item) => (item.id === editingId ? updated : item))
        );
      } else {
        await fetchAppointments();
      }
      resetForm();
      return;
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert(payload)
      .select();

    setSaving(false);

    if (error) {
      console.error('Supabase insert error:', error);
      setErrorMsg(error.message);
      return;
    }

    if (data && data.length > 0) {
      setAppointments((prev) => [...prev, ...(data as Appointment[])]);
    } else {
      await fetchAppointments();
    }

    resetForm();
  }

  async function handleDeleteAppointment(id: string) {
    setErrorMsg(null);
    const { error } = await supabase.from('appointments').delete().eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      setErrorMsg(error.message);
      return;
    }

    setAppointments((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      resetForm();
    }
  }

  const filteredAppointments = appointments.filter((appt) =>
    selectedMember === 'all' ? true : appt.member === selectedMember
  );

  return (
    <div
      className={`min-h-screen bg-slate-50 text-slate-900 ${
        largePrint ? 'text-xl' : 'text-base'
      }`}
    >
      <header className="border-b border-slate-200 bg-white px-4 py-5 shadow-xs">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-700" aria-hidden="true" />
            <div>
              <h1 className={largePrint ? 'text-3xl font-bold' : 'text-2xl font-bold'}>
                Family Appointment Planner
              </h1>
              <p className="text-sm text-slate-600">
                Shared schedule for Tom, Kandi, Faith, Granger, Amy, Charlie, Betty, and Robert
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLargePrint((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-medium text-slate-800 hover:bg-slate-100"
            >
              <Type className="h-4 w-4" aria-hidden="true" />
              {largePrint ? 'Standard Text' : 'Large Print'}
            </button>

            <button
              type="button"
              onClick={startNewAppointment}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Add Appointment
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
            <strong>Database error:</strong> {errorMsg}
          </div>
        )}

        {/* Filter Bar */}
        <section aria-label="Filter by family member" className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Show Appointments For:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedMember('all')}
              aria-pressed={selectedMember === 'all'}
              className={`rounded-xl border font-semibold transition ${
                largePrint ? 'px-5 py-3 text-xl' : 'px-4 py-2 text-sm'
              } ${
                selectedMember === 'all'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Everyone
            </button>

            {FAMILY_MEMBERS.map((person) => {
              const active = selectedMember === person;
              const style = MEMBER_STYLES[person];
              return (
                <button
                  key={person}
                  type="button"
                  onClick={() => setSelectedMember(person)}
                  aria-pressed={active}
                  className={`rounded-xl border font-semibold transition ${
                    largePrint ? 'px-5 py-3 text-xl' : 'px-4 py-2 text-sm'
                  } ${
                    active
                      ? `${style.badge} ring-2 ring-slate-900 ring-offset-2`
                      : `${style.pill} hover:brightness-95`
                  }`}
                >
                  {person}
                </button>
              );
            })}
          </div>
        </section>

        {/* Add / Edit Appointment Form */}
        {showForm && (
          <form
            onSubmit={handleSaveAppointment}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <h2 className="text-lg font-bold text-slate-900">
              {editingId ? 'Edit Appointment' : 'New Appointment'}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Appointment Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Eye Doctor or Oil Change"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">Who Is It For?</label>
                <select
                  value={member}
                  onChange={(e) => setMember(e.target.value as FamilyMember)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                >
                  {FAMILY_MEMBERS.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">Time</label>
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="e.g., 10:00 AM"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block font-medium text-slate-700">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Clinic address, school, or home"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block font-medium text-slate-700">Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reminders, paperwork to bring, etc."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                />
              </div>
            </div>

            {/* Pre-Save Conflict Warning Calling Out Date & Details */}
            {formOverlaps.length > 0 && !isFormConflictDismissed && (
              <div
                role="alert"
                className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <p className="font-bold">
                        Date &amp; Driver Overlap on {date} — Review Before Confirming
                      </p>
                      <p>
                        You selected date <strong>{date}</strong> (time:{' '}
                        <strong>{time.trim() || 'All Day'}</strong>), which overlaps with:
                      </p>
                      <ul className="list-disc pl-5">
                        {formOverlaps.map(({ appointment: c, reasons }) => (
                          <li key={c.id}>
                            <strong>{c.title}</strong> — {c.member} on <strong>{c.date}</strong> at{' '}
                            {c.time} ({c.location}) — <em>{reasons.join(', ')}</em>
                          </li>
                        ))}
                      </ul>
                      <p className="pt-1 text-sm text-amber-900">
                        If parents or grandparents are seeing the same doctor together, you can
                        dismiss this warning and still save.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDismissedConflictKey(currentConflictKey)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-100"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Dismiss Warning
                  </button>
                </div>
              </div>
            )}

            {formOverlaps.length > 0 && isFormConflictDismissed && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-700">
                <span>
                  Date overlap warning on <strong>{date}</strong> dismissed—you can still save or
                  review again.
                </span>
                <button
                  type="button"
                  onClick={() => setDismissedConflictKey(null)}
                  className="font-semibold text-blue-700 underline hover:text-blue-900"
                >
                  Show Warning Again
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : editingId
                    ? 'Update Appointment'
                    : formOverlaps.length > 0 && !isFormConflictDismissed
                      ? 'Confirm & Save Anyway'
                      : 'Save Appointment'}
              </button>
            </div>
          </form>
        )}

        {/* Agenda Cards */}
        <section aria-label="Upcoming appointments" className="space-y-3">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
              Loading appointments...
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
              No appointments match this filter yet. Click <strong>Add Appointment</strong> to create
              one.
            </div>
          ) : (
            filteredAppointments.map((appt) => {
              const style =
                MEMBER_STYLES[appt.member as FamilyMember] ?? FALLBACK_STYLE;
              const overlaps = getOverlapMatches(appt, appointments);
              const showCardConflict =
                overlaps.length > 0 && !dismissedCardIds[appt.id];

              return (
                <article
                  key={appt.id}
                  className={`rounded-xl border border-slate-200 border-l-8 ${style.border} bg-white p-5 shadow-xs`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-bold text-slate-900">{appt.title}</h2>
                      <span
                        className={`rounded-full border px-3 py-0.5 text-sm font-semibold ${style.badge}`}
                      >
                        {appt.member}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditAppointment(appt)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        aria-label={`Edit ${appt.title}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAppointment(appt.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                        aria-label={`Delete ${appt.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      {appt.date}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      {appt.time}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      {appt.location}
                    </span>
                  </div>

                  {appt.notes && (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                      <strong className="font-semibold">Note:</strong> {appt.notes}
                    </p>
                  )}

                  {showCardConflict && (
                    <div
                      role="alert"
                      className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                          aria-hidden="true"
                        />
                        <div>
                          <strong>Date overlap on {appt.date}:</strong> Overlaps with{' '}
                          {overlaps
                            .map(
                              ({ appointment: c }) =>
                                `${c.title} (${c.member}, date ${c.date}, ${c.time})`
                            )
                            .join(', ')}
                          .
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setDismissedCardIds((prev) => ({
                            ...prev,
                            [appt.id]: true,
                          }))
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
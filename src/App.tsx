import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutList,
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
type ViewMode = 'list' | 'calendar';

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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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

function normalizeDate(value: string): string {
  return value.trim().slice(0, 10);
}

function normalizeTime(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatIsoDate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function formatMonthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
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
  const candidateDate = normalizeDate(candidate.date);
  if (!candidateDate) return [];

  const candidateTime = normalizeTime(candidate.time);
  const matches: OverlapMatch[] = [];

  for (const existing of allAppointments) {
    if (candidate.id && existing.id === candidate.id) continue;
    const existingDate = normalizeDate(existing.date);
    if (existingDate !== candidateDate) continue;

    const existingTime = normalizeTime(existing.time);
    const sameSpecificTime =
      candidateTime !== '' &&
      candidateTime !== 'all day' &&
      candidateTime === existingTime;
    const samePerson = existing.member === candidate.member;

    const reasons: string[] = [`same date (${existingDate})`];
    if (sameSpecificTime) {
      reasons.push(`same time (${existing.time})`);
    }
    if (samePerson) {
      reasons.push(`same person (${existing.member})`);
    }

    matches.push({ appointment: existing, reasons });
  }

  return matches;
}

function getTodayIsoDate(): string {
  const now = new Date();
  return formatIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

export function App() {
  const todayIso = getTodayIsoDate();
  const initialDate = new Date();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberFilter>('all');
  const [largePrint, setLargePrint] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calendarYear, setCalendarYear] = useState<number>(initialDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [member, setMember] = useState<FamilyMember>('Charlie');
  const [date, setDate] = useState<string>(todayIso);
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

  function resetForm(presetDate = selectedDate || todayIso) {
    setTitle('');
    setMember('Charlie');
    setDate(normalizeDate(presetDate) || todayIso);
    setTime('10:00 AM');
    setLocation('');
    setNotes('');
    setEditingId(null);
    setDismissedConflictKey(null);
    setShowForm(false);
  }

  function startNewAppointment(presetDate?: string) {
    resetForm(presetDate ?? selectedDate ?? todayIso);
    setShowForm(true);
  }

  function startEditAppointment(appt: Appointment) {
    const normalized = normalizeDate(appt.date);
    setEditingId(appt.id);
    setTitle(appt.title);
    setMember(
      FAMILY_MEMBERS.includes(appt.member as FamilyMember)
        ? (appt.member as FamilyMember)
        : 'Charlie'
    );
    setDate(normalized);
    setSelectedDate(normalized);
    setTime(appt.time);
    setLocation(appt.location === 'TBD' ? '' : appt.location);
    setNotes(appt.notes ?? '');
    setDismissedConflictKey(null);
    setShowForm(true);
  }

  function handleSelectCalendarDate(isoDate: string) {
    setSelectedDate(isoDate);
    if (showForm && !editingId) {
      setDate(isoDate);
    }
  }

  function shiftMonth(deltaMonths: number) {
    const shifted = new Date(calendarYear, calendarMonth + deltaMonths, 1);
    const nextYear = shifted.getFullYear();
    const nextMonth = shifted.getMonth();
    setCalendarYear(nextYear);
    setCalendarMonth(nextMonth);
    setSelectedDate(formatIsoDate(nextYear, nextMonth, 1));
  }

  function jumpToToday() {
    const now = new Date();
    const iso = formatIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setSelectedDate(iso);
  }

  const normalizedFormDate = normalizeDate(date);
  const formOverlaps = showForm
    ? getOverlapMatches(
        { id: editingId, member, date: normalizedFormDate, time: time.trim() || 'All Day' },
        appointments
      )
    : [];

  const currentConflictKey =
    formOverlaps.length > 0
      ? `${normalizedFormDate}|${normalizeTime(time)}|${member}|${formOverlaps
          .map((m) => m.appointment.id)
          .sort()
          .join(',')}`
      : null;

  const isFormConflictDismissed =
    currentConflictKey !== null && dismissedConflictKey === currentConflictKey;

  async function handleSaveAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !normalizedFormDate) return;

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      title: title.trim(),
      member,
      date: normalizedFormDate,
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
      setSelectedDate(normalizedFormDate);
      resetForm(normalizedFormDate);
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

    setSelectedDate(normalizedFormDate);
    resetForm(normalizedFormDate);
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

  // Group filtered appointments by YYYY-MM-DD for fast calendar cell lookup
  const appointmentsByDate = filteredAppointments.reduce<Record<string, Appointment[]>>(
    (acc, appt) => {
      const iso = normalizeDate(appt.date);
      if (!iso) return acc;
      if (!acc[iso]) acc[iso] = [];
      acc[iso].push(appt);
      return acc;
    },
    {}
  );

  const firstWeekdayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarCells: Array<{ day: number; isoDate: string } | null> = [
    ...Array.from({ length: firstWeekdayIndex }, () => null),
    ...Array.from({ length: daysInMonth }, (_, idx) => {
      const dayNumber = idx + 1;
      return {
        day: dayNumber,
        isoDate: formatIsoDate(calendarYear, calendarMonth, dayNumber),
      };
    }),
  ];

  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const selectedDayAppointments = appointmentsByDate[selectedDate] ?? [];

  function renderAppointmentCard(appt: Appointment) {
    const style = MEMBER_STYLES[appt.member as FamilyMember] ?? FALLBACK_STYLE;
    const overlaps = getOverlapMatches(appt, appointments);
    const showCardConflict = overlaps.length > 0 && !dismissedCardIds[appt.id];
    const apptDate = normalizeDate(appt.date);

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
            {apptDate}
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
                <strong>Same date ({apptDate}):</strong> Also scheduled on{' '}
                {overlaps
                  .map(
                    ({ appointment: c }) =>
                      `${c.title} (${c.member}, date ${normalizeDate(c.date)}, ${c.time})`
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
  }

  return (
    <div
      className={`min-h-screen bg-slate-50 text-slate-900 ${
        largePrint ? 'text-xl' : 'text-base'
      }`}
    >
      <header className="border-b border-slate-200 bg-white px-4 py-5 shadow-xs">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
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

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div
              role="group"
              aria-label="Schedule view mode"
              className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1"
            >
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <LayoutList className="h-4 w-4" aria-hidden="true" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                aria-pressed={viewMode === 'calendar'}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                  viewMode === 'calendar'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Month Calendar
              </button>
            </div>

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
              onClick={() => startNewAppointment()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Add Appointment
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
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
                  onChange={(e) => {
                    const nextIso = normalizeDate(e.target.value);
                    setDate(e.target.value);
                    if (nextIso) setSelectedDate(nextIso);
                  }}
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

            {/* Pre-Save Same-Date Warning (Dismissible, Non-Blocking) */}
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
                        Same-Date Appointment Alert on {normalizedFormDate} — Review Before Confirming
                      </p>
                      <p>
                        Another family appointment is already scheduled on{' '}
                        <strong>{normalizedFormDate}</strong> (regardless of who it is for):
                      </p>
                      <ul className="list-disc pl-5">
                        {formOverlaps.map(({ appointment: c, reasons }) => (
                          <li key={c.id}>
                            <strong>{c.title}</strong> — {c.member} on{' '}
                            <strong>{normalizeDate(c.date)}</strong> at {c.time} ({c.location}) —{' '}
                            <em>{reasons.join(', ')}</em>
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
                  Same-date warning on <strong>{normalizedFormDate}</strong> dismissed—you can still
                  save or review again.
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
                onClick={() => resetForm()}
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

        {/* Active Schedule View */}
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            Loading appointments...
          </div>
        ) : viewMode === 'calendar' ? (
          <section aria-label="Month calendar view" className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
              {/* Month Navigation Header */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className={largePrint ? 'text-2xl font-bold' : 'text-xl font-bold'}>
                  {formatMonthLabel(calendarYear, calendarMonth)}
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={jumpToToday}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                    aria-label="Next month"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Weekday Labels */}
              <div className="grid grid-cols-7 gap-1.5 pb-2 text-center font-semibold text-slate-600">
                {WEEKDAYS.map((dayName) => (
                  <div
                    key={dayName}
                    className={largePrint ? 'py-1 text-base' : 'py-1 text-xs uppercase tracking-wide'}
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Calendar Day Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((cell, index) => {
                  if (!cell) {
                    return (
                      <div
                        key={`empty-${index}`}
                        aria-hidden="true"
                        className={`rounded-lg border border-transparent bg-slate-50/70 ${
                          largePrint ? 'min-h-32' : 'min-h-24'
                        }`}
                      />
                    );
                  }

                  const dayAppts = appointmentsByDate[cell.isoDate] ?? [];
                  const isSelected = selectedDate === cell.isoDate;
                  const isToday = todayIso === cell.isoDate;
                  const hasMultiple = dayAppts.length > 1;

                  return (
                    <button
                      key={cell.isoDate}
                      type="button"
                      onClick={() => handleSelectCalendarDate(cell.isoDate)}
                      aria-pressed={isSelected}
                      className={`flex flex-col items-start justify-between rounded-lg border p-2 text-left transition ${
                        largePrint ? 'min-h-32' : 'min-h-24'
                      } ${
                        isSelected
                          ? 'border-blue-700 bg-blue-50/60 ring-2 ring-blue-700'
                          : hasMultiple
                            ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-bold ${
                            isToday
                              ? 'bg-blue-700 text-white'
                              : isSelected
                                ? 'bg-blue-100 text-blue-900'
                                : 'text-slate-900'
                          }`}
                        >
                          {cell.day}
                        </span>

                        {hasMultiple && (
                          <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-xs font-bold text-amber-950">
                            {dayAppts.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex w-full flex-col gap-1">
                        {dayAppts.slice(0, largePrint ? 2 : 3).map((appt) => {
                          const style =
                            MEMBER_STYLES[appt.member as FamilyMember] ?? FALLBACK_STYLE;
                          return (
                            <span
                              key={appt.id}
                              className={`truncate rounded border px-1.5 py-0.5 font-semibold ${
                                largePrint ? 'text-sm' : 'text-xs'
                              } ${style.pill}`}
                            >
                              {appt.member}: {appt.title}
                            </span>
                          );
                        })}

                        {dayAppts.length > (largePrint ? 2 : 3) && (
                          <span className="text-xs font-semibold text-slate-600">
                            +{dayAppts.length - (largePrint ? 2 : 3)} more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Details & Quick Add */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className={largePrint ? 'text-xl font-bold' : 'text-lg font-bold'}>
                    Appointments on {selectedDate}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {selectedDayAppointments.length === 0
                      ? 'No appointments scheduled for this filter on this date.'
                      : `${selectedDayAppointments.length} appointment(s) on this date—check ride timing or dismiss if shared.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => startNewAppointment(selectedDate)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 font-semibold text-white hover:bg-blue-800"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add on {selectedDate}
                </button>
              </div>

              {selectedDayAppointments.length > 0 && (
                <div className="space-y-3 pt-2">
                  {selectedDayAppointments.map((appt) => renderAppointmentCard(appt))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section aria-label="Upcoming appointments" className="space-y-3">
            {filteredAppointments.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
                No appointments match this filter yet. Click <strong>Add Appointment</strong> to
                create one.
              </div>
            ) : (
              filteredAppointments.map((appt) => renderAppointmentCard(appt))
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
import { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, Pencil, Plus, Trash2, Type, Users } from 'lucide-react';
import { supabase } from './lib/supabase';

type MemberId = 'all' | 'household' | 'parents' | 'grandparents' | 'kids';

interface Appointment {
  id: string;
  title: string;
  member: Exclude<MemberId, 'all'>;
  date: string;
  time: string;
  location: string;
  notes?: string | null;
  created_at?: string;
}

const FAMILY_GROUPS: Record<
  Exclude<MemberId, 'all'>,
  { label: string; badgeClass: string; borderClass: string }
> = {
  household: {
    label: 'Charles & Kandi',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    borderClass: 'border-l-blue-600',
  },
  parents: {
    label: 'Parents',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    borderClass: 'border-l-emerald-600',
  },
  grandparents: {
    label: 'Grandparents',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    borderClass: 'border-l-amber-600',
  },
  kids: {
    label: 'Faith & Granger',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
    borderClass: 'border-l-purple-600',
  },
};

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
  const [selectedMember, setSelectedMember] = useState<MemberId>('all');
  const [largePrint, setLargePrint] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [member, setMember] = useState<Exclude<MemberId, 'all'>>('grandparents');
  const [date, setDate] = useState<string>(() => getTodayIsoDate());
  const [time, setTime] = useState('10:00 AM');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState<boolean>(false);

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
    setMember('grandparents');
    setDate(getTodayIsoDate());
    setTime('10:00 AM');
    setLocation('');
    setNotes('');
    setEditingId(null);
    setShowForm(false);
  }

  function startNewAppointment() {
    resetForm();
    setShowForm(true);
  }

  function startEditAppointment(appt: Appointment) {
    setEditingId(appt.id);
    setTitle(appt.title);
    setMember(appt.member);
    setDate(appt.date);
    setTime(appt.time);
    setLocation(appt.location === 'TBD' ? '' : appt.location);
    setNotes(appt.notes ?? '');
    setShowForm(true);
  }

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
        setAppointments((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
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
                Shared schedule for household, parents, grandparents, and kids
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
        <section aria-label="Filter by family group" className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Show Appointments For:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedMember('all')}
              className={`rounded-full border px-4 py-2 font-semibold transition ${
                selectedMember === 'all'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Everyone
            </button>

            {(Object.keys(FAMILY_GROUPS) as Array<Exclude<MemberId, 'all'>>).map((key) => {
              const group = FAMILY_GROUPS[key];
              const active = selectedMember === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedMember(key)}
                  className={`rounded-full border px-4 py-2 font-semibold transition ${
                    active
                      ? 'ring-2 ring-slate-900 ring-offset-1 ' + group.badgeClass
                      : group.badgeClass + ' opacity-85 hover:opacity-100'
                  }`}
                >
                  {group.label}
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
                  onChange={(e) => setMember(e.target.value as Exclude<MemberId, 'all'>)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                >
                  {(Object.keys(FAMILY_GROUPS) as Array<Exclude<MemberId, 'all'>>).map((key) => (
                    <option key={key} value={key}>
                      {FAMILY_GROUPS[key].label}
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
                {saving ? 'Saving...' : editingId ? 'Update Appointment' : 'Save Appointment'}
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
              const group = FAMILY_GROUPS[appt.member];
              return (
                <article
                  key={appt.id}
                  className={`rounded-xl border border-slate-200 border-l-8 ${group.borderClass} bg-white p-5 shadow-xs`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-bold text-slate-900">{appt.title}</h2>
                      <span
                        className={`rounded-full border px-3 py-0.5 text-sm font-semibold ${group.badgeClass}`}
                      >
                        {group.label}
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
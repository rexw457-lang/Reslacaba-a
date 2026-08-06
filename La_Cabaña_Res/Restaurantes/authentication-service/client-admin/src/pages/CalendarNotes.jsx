import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const getDayKey = (date) => {
  const parsed = new Date(date);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getDayLabel = (date) => new Date(date).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const getMonthLabel = (year, month) => `${monthNames[month]} ${year}`;

export const CalendarNotes = () => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [currentYear, setCurrentYear] = useState(() => currentDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => currentDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(() => currentDate);
  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('calendarNotes') || '{}');
    } catch {
      return {};
    }
  });
  const [draftNote, setDraftNote] = useState('');

  useEffect(() => {
    const interval = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (getDayKey(selectedDate) === getDayKey(currentDate) && (year !== currentYear || month !== currentMonth)) {
      setCurrentYear(year);
      setCurrentMonth(month);
    }
  }, [currentDate, currentMonth, currentYear, selectedDate]);

  useEffect(() => {
    const key = getDayKey(selectedDate);
    setDraftNote(notes[key] || '');
  }, [selectedDate, notes]);

  const saveNotes = (key, value) => {
    setNotes((previous) => {
      const updated = { ...previous };
      if (value.trim()) {
        updated[key] = value.trim();
      } else {
        delete updated[key];
      }
      localStorage.setItem('calendarNotes', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSave = () => {
    saveNotes(getDayKey(selectedDate), draftNote);
  };

  const handleMonthChange = (delta) => {
    const next = new Date(currentYear, currentMonth + delta, 1);
    setCurrentYear(next.getFullYear());
    setCurrentMonth(next.getMonth());
  };

  const monthlyDays = useMemo(() => {
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthLength = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDay = ((monthStart.getDay() + 6) % 7);
    const days = [];

    for (let i = 0; i < startDay; i += 1) {
      days.push(null);
    }

    for (let day = 1; day <= monthLength; day += 1) {
      days.push(new Date(currentYear, currentMonth, day));
    }

    return days;
  }, [currentMonth, currentYear]);

  const selectedKey = getDayKey(selectedDate);
  const selectedNote = notes[selectedKey] || '';

  return (
    <div className='space-y-8'>
      <div className='admin-panel p-6'>
        <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <p className='admin-kicker'>Calendario de notas</p>
            <h1 className='admin-title mt-2'>Apunta avisos importantes por día</h1>
            <p className='admin-subtitle mt-3 max-w-2xl text-sm'>El calendario se actualiza con la fecha real y te permite anotar recordatorios para cualquier día.</p>
            <Link
              to='/dashboard'
              className='mt-4 inline-flex items-center rounded-3xl border border-[#e6be7d]/15 bg-[#141426]/90 px-4 py-2 text-sm font-bold text-[#e6be7d] transition hover:border-[#e6be7d] hover:bg-[#161d33]'
            >
              Regresar a dashboard
            </Link>
          </div>
          <div className='rounded-3xl bg-[#0f182f] px-5 py-4 text-right'>
            <p className='text-sm uppercase tracking-[0.24em] text-[#e6be7d]'>Hoy</p>
            <p className='mt-2 text-xl font-black text-[#e0e0e0]'>{getDayLabel(currentDate)}</p>
          </div>
        </div>
      </div>

      <section className='grid gap-6 xl:grid-cols-[1.5fr_1fr]'>
        <div className='admin-panel p-6'>
          <div className='flex items-center justify-between gap-3 border-b border-[#e6be7d]/10 pb-4'>
            <div>
              <h2 className='text-lg font-black text-[#e0e0e0]'>{getMonthLabel(currentYear, currentMonth)}</h2>
              <p className='text-sm text-[#e6be7d]'>Selecciona una fecha para escribir una nota.</p>
            </div>
            <div className='flex gap-2'>
              <button type='button' onClick={() => handleMonthChange(-1)} className='admin-button-secondary px-4 py-2 text-sm'>Anterior</button>
              <button type='button' onClick={() => handleMonthChange(1)} className='admin-button-secondary px-4 py-2 text-sm'>Siguiente</button>
            </div>
          </div>

          <div className='mt-6 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.16em] text-[#e6be7d]'>
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className='mt-3 grid grid-cols-7 gap-3'>
            {monthlyDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className='h-24 rounded-3xl bg-[#141426]/90' />;
              }

              const key = getDayKey(date);
              const isToday = key === getDayKey(currentDate);
              const hasNote = Boolean(notes[key]);
              const isSelected = key === selectedKey;

              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => setSelectedDate(date)}
                  className={`group relative h-24 rounded-3xl border p-3 text-left transition ${isSelected ? 'border-[#e6be7d] bg-[#141426]/90 shadow-lg' : 'border-[#e6be7d]/10 bg-[#0f172f] hover:bg-[#141426]/70'} ${isToday ? 'ring-2 ring-[#e6be7d]/50' : ''}`}
                >
                  <span className='text-sm font-black text-[#e0e0e0]'>{date.getDate()}</span>
                  <span className='mt-1 block text-[11px] text-[#a1c5ff]'>{hasNote ? 'Nota guardada' : 'Sin nota'}</span>
                  {hasNote && <span className='absolute right-3 top-3 h-2 w-2 rounded-full bg-[#e6be7d]' />}
                </button>
              );
            })}
          </div>
        </div>

        <aside className='admin-panel p-6'>
          <div className='flex flex-col gap-2'>
            <p className='text-sm uppercase tracking-[0.24em] text-[#e6be7d]'>Fecha seleccionada</p>
            <h2 className='text-2xl font-black text-[#e0e0e0]'>{getDayLabel(selectedDate)}</h2>
          </div>

          <div className='mt-6 space-y-4'>
            <label className='block text-sm font-bold text-[#e0e0e0]'>Notas del día</label>
            <textarea
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              rows={10}
              className='admin-input w-full resize-none rounded-3xl border border-[#e6be7d]/15 bg-[#141426]/80 px-4 py-3 text-sm text-[#e0e0e0] focus:border-[#e6be7d] focus:outline-none'
              placeholder='Escribe tus notas importantes aquí...'
            />
            <button type='button' onClick={handleSave} className='admin-button-primary w-full px-4 py-3 text-sm'>Guardar nota</button>
            <p className='text-xs text-[#a1c5ff]'>La nota se guarda localmente en el navegador y se mantiene al recargar.</p>
          </div>
        </aside>
      </section>
    </div>
  );
};

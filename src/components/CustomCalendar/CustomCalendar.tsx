import React, { useState, useMemo, useEffect } from 'react';
import moment from 'moment';
import 'moment/locale/pt-br';
import styles from './CustomCalendar.module.css';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, ChevronDown } from 'lucide-react';

moment.locale('pt-br');

export interface CalendarEvent {
  id: number | string;
  title: string;
  start: Date;
  end: Date;
  resource?: any;
}

interface CustomCalendarProps {
  events: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  onNavigate?: (date: Date) => void;
  date?: Date;
  view?: 'month' | 'week' | 'day';
  onViewChange?: (view: 'month' | 'week' | 'day') => void;
  statusMeta?: (status?: string) => { color: string; label: string; icon: any };
}

const CustomCalendar: React.FC<CustomCalendarProps> = ({
  events,
  onSelectEvent,
  onSelectSlot,
  onNavigate,
  date: externalDate,
  view: externalView = 'month',
  onViewChange,
  statusMeta,
}) => {
  const [currentDate, setCurrentDate] = useState(externalDate || new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>(externalView);

  useEffect(() => {
    if (externalDate) {
      setCurrentDate(externalDate);
    }
  }, [externalDate]);

  useEffect(() => {
    if (externalView) {
      setView(externalView);
    }
  }, [externalView]);

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
    if (onNavigate) {
      onNavigate(newDate);
    }
  };

  const navigate = (direction: 'prev' | 'next') => {
    const unit: 'month' | 'week' | 'day' = view;
    const amount = direction === 'next' ? 1 : -1;
    const next = moment(currentDate).add(amount, unit).toDate();
    handleNavigate(next);
  };


  const handleViewChange = (newView: 'month' | 'week' | 'day') => {
    setView(newView);
    if (onViewChange) {
      onViewChange(newView);
    }
  };

  // Month Logic
  const monthDays = useMemo(() => {
    const startOfMonth = moment(currentDate).startOf('month');
    const endOfMonth = moment(currentDate).endOf('month');
    const startOfWeek = moment(startOfMonth).startOf('week');
    const endOfWeek = moment(endOfMonth).endOf('week');

    const days = [];
    let day = moment(startOfWeek);

    while (day.isBefore(endOfWeek)) {
      days.push(day.toDate());
      day = moment(day).add(1, 'day');
    }
    return days;
  }, [currentDate]);

  // Week Logic
  const weekDays = useMemo(() => {
    const startOfWeek = moment(currentDate).startOf('week');
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(moment(startOfWeek).add(i, 'day').toDate());
    }
    return days;
  }, [currentDate]);

  const weekDaysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getEventsInRange = (start: Date, end: Date) => {
    return events.filter((event) => {
      const s = moment(event.start);
      return s.isSameOrAfter(moment(start).startOf('day')) && s.isSameOrBefore(moment(end).endOf('day'));
    });
  };

  const getEventsForDay = (day: Date) => {
    return events.filter((event) =>
      moment(event.start).isSame(day, 'day')
    ).sort((a, b) => moment(a.start).diff(moment(b.start)));
  };

  const isToday = (day: Date) => moment(day).isSame(new Date(), 'day');
  const isSelected = (day: Date) => moment(day).isSame(currentDate, 'day');
  const isCurrentMonth = (day: Date) => moment(day).isSame(currentDate, 'month');

  const getHeaderTitle = () => {
    if (view === 'month') return moment(currentDate).format('MMMM [de] YYYY');
    if (view === 'week') {
      const start = moment(currentDate).startOf('week');
      const end = moment(currentDate).endOf('week');
      if (start.month() === end.month()) {
        return `${start.format('DD')} - ${end.format('DD')} de ${start.format('MMMM')}`;
      }
      return `${start.format('DD MMM')} - ${end.format('DD MMM')}`;
    }
    return moment(currentDate).format('DD [de] MMMM');
  };

  return (
    <div className={styles.calendarWrapper}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.navigation}>
            <button type="button" onClick={() => navigate('prev')} className={styles.navButton} aria-label="Anterior">
              <ChevronLeft size={18} />
            </button>
            <h2 className={styles.monthTitle}>
              {getHeaderTitle()}
            </h2>
            <button type="button" onClick={() => navigate('next')} className={styles.navButton} aria-label="Próximo">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className={styles.viewTabs}>
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleViewChange(v)}
              className={`${styles.viewTab} ${view === v ? styles.activeTab : ''}`}
            >
              {v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}
            </button>
          ))}
        </div>
      </header>

      {view === 'month' && (
        <div className={styles.monthGrid}>
          {weekDaysShort.map((day) => (
            <div key={day} className={styles.weekdayHeader}>
              {day}
            </div>
          ))}
          {monthDays.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            return (
              <div
                key={idx}
                className={`${styles.dayCell} ${!isCurrentMonth(day) ? styles.offRange : ''} ${
                  isSelected(day) ? styles.selectedDay : ''
                }`}
                onClick={() => {
                  handleNavigate(day);
                  if (onSelectSlot) {
                    onSelectSlot({ start: day, end: day });
                  }
                }}
              >
                <div className={styles.dayNumberWrapper}>
                  <span className={`${styles.dayNumber} ${isToday(day) ? styles.today : ''}`}>
                    {moment(day).format('D')}
                  </span>
                </div>
                <div className={styles.eventDots}>
                  {dayEvents.slice(0, 3).map((event, i) => {
                    const meta = statusMeta ? statusMeta(event.resource?.status) : { color: '#e67e22' };
                    return (
                      <div
                        key={i}
                        className={styles.eventDot}
                        style={{ backgroundColor: meta.color }}
                        title={`${moment(event.start).format('HH:mm')} - ${event.title}`}
                      />
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <span className={styles.moreEvents}>+{dayEvents.length - 3}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(view === 'week' || view === 'day') && (
        <div className={styles.agendaView}>
          {(view === 'week' ? weekDays : [currentDate]).map((day) => {
            const dayEvents = getEventsForDay(day);
            return (
              <div key={day.toISOString()} className={styles.agendaDay}>
                <div className={styles.agendaDayHeader}>
                  <span className={styles.agendaDayName}>{moment(day).format('ddd')}</span>
                  <span className={`${styles.agendaDayNumber} ${isToday(day) ? styles.todayCircle : ''}`}>
                    {moment(day).format('DD')}
                  </span>
                </div>
                <div className={styles.agendaEvents}>
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event) => {
                      const meta = statusMeta ? statusMeta(event.resource?.status) : { color: '#e67e22' };
                      return (
                        <div
                          key={event.id}
                          className={styles.agendaEvent}
                          onClick={() => onSelectEvent && onSelectEvent(event)}
                        >
                          <div className={styles.agendaEventTime}>
                            {moment(event.start).format('HH:mm')}
                          </div>
                          <div className={styles.agendaEventContent} style={{ borderLeftColor: meta.color }}>
                            <div className={styles.agendaEventTitle}>{event.title}</div>
                            {event.resource?.tipo && (
                              <div className={styles.agendaEventType}>{event.resource.tipo}</div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={styles.noEvents}>Nenhuma consulta</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomCalendar;

"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import moment from 'moment';
import 'moment/locale/pt-br';
import styles from './MiniCalendar.module.css';

moment.locale('pt-br');

interface MiniCalendarProps {
  selectedDate: Date | null;
  onSelect: (date: string) => void;
  onClose: () => void;
  minDate?: string;
  maxDate?: string;
  showYearPicker?: boolean;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ selectedDate, onSelect, onClose, minDate, maxDate, showYearPicker = false }) => {
  const [currentMonth, setCurrentMonth] = useState(moment(selectedDate || new Date()).startOf('month'));
  
  const today = moment().startOf('day');
  const minMoment = minDate ? moment(minDate).startOf('day') : null;
  const maxMoment = maxDate ? moment(maxDate).startOf('day') : null;
  const selectedMoment = selectedDate ? moment(selectedDate).startOf('day') : null;

  const startDay = currentMonth.clone().startOf('month').startOf('week');
  const endDay = currentMonth.clone().endOf('month').endOf('week');

  const calendarRows = [];
  const day = startDay.clone();

  while (day.isBefore(endDay, 'day')) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(day.clone());
      day.add(1, 'day');
    }
    calendarRows.push(week);
  }

  const nextMonth = () => setCurrentMonth(currentMonth.clone().add(1, 'month'));
  const prevMonth = () => setCurrentMonth(currentMonth.clone().subtract(1, 'month'));

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className={styles.miniCalendarContainer}>
      <div className={styles.header}>
        {showYearPicker ? (
          <div className={styles.yearMonthPicker}>
            <span className={styles.monthLabel} style={{ textTransform: 'capitalize' }}>
              {currentMonth.format('MMMM')}
            </span>
            <select
              value={currentMonth.year()}
              onChange={(e) => setCurrentMonth(currentMonth.clone().year(parseInt(e.target.value)))}
              className={styles.yearSelect}
            >
              {Array.from({ length: 120 }, (_, i) => moment().year() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        ) : (
          <span className={styles.monthLabel}>
            {currentMonth.format('MMMM YYYY')}
          </span>
        )}
        <div className={styles.navButtons}>
          <button className={styles.navBtn} onClick={prevMonth} type="button">
            <ChevronLeft size={16} />
          </button>
          <button className={styles.navBtn} onClick={nextMonth} type="button">
            <ChevronRight size={16} />
          </button>
          <button className={`${styles.navBtn} ${styles.closeBtn}`} onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className={styles.weekdays}>
        {weekdays.map(wd => (
          <div key={wd} className={styles.weekday}>{wd}</div>
        ))}
      </div>

      <div className={styles.daysGrid}>
        {calendarRows.map((week, i) => (
          <div key={i} className={styles.weekRow}>
            {week.map(d => {
              const isOtherMonth = !d.isSame(currentMonth, 'month');
              const isSelected = selectedMoment && d.isSame(selectedMoment, 'day');
              const isToday = d.isSame(today, 'day');
              const isDisabled = (minMoment ? d.isBefore(minMoment, 'day') : false) || (maxMoment ? d.isAfter(maxMoment, 'day') : false);
              
              return (
                <div
                  key={d.toString()}
                  className={`${styles.day} ${isOtherMonth ? styles.otherMonth : ''} ${isSelected ? styles.selected : ''} ${isToday ? styles.today : ''} ${isDisabled ? styles.disabled : ''}`}
                  onClick={() => !isDisabled && onSelect(d.format('YYYY-MM-DD'))}
                >
                  {d.date()}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MiniCalendar;

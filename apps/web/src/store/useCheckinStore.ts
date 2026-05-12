import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export interface Lesson {
  id: number;
  title: string;
  status: LessonStatus;
  note: string;
  dateCompleted?: string;
  rating?: number;
}

interface CheckinState {
  lessons: Lesson[];
  checkIn: (id: number, note: string, rating: number) => void;
  startLesson: (id: number) => void;
  getOverallProgress: () => { completed: number; total: number; percentage: number };
  getStreak: () => number;
}

// Generate 144 lessons
const initialLessons: Lesson[] = Array.from({ length: 144 }, (_, i) => ({
  id: i + 1,
  title: `Lesson ${i + 1}`,
  status: 'not_started',
  note: '',
}));

export const useCheckinStore = create<CheckinState>()(
  persist(
    (set, get) => ({
      lessons: initialLessons,
      checkIn: (id, note, rating) => {
        set((state) => {
          const updated = state.lessons.map((lesson) => {
            if (lesson.id === id) {
              return {
                ...lesson,
                status: 'completed' as LessonStatus,
                note,
                rating,
                dateCompleted: new Date().toISOString(),
              };
            }
            return lesson;
          });
          return { lessons: updated };
        });
      },
      startLesson: (id) => {
        set((state) => {
          const updated = state.lessons.map((lesson) => {
            if (lesson.id === id && lesson.status === 'not_started') {
              return { ...lesson, status: 'in_progress' as LessonStatus };
            }
            return lesson;
          });
          return { lessons: updated };
        });
      },
      getOverallProgress: () => {
        const { lessons } = get();
        const completed = lessons.filter((l) => l.status === 'completed').length;
        const total = lessons.length;
        return {
          completed,
          total,
          percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
        };
      },
      getStreak: () => {
        // Simplified streak calculation based on dates completed
        const { lessons } = get();
        const completedDates = lessons
          .filter((l) => l.dateCompleted)
          .map((l) => new Date(l.dateCompleted!).toDateString());
        
        const uniqueDates = Array.from(new Set(completedDates)).sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime()
        );

        if (uniqueDates.length === 0) return 0;
        
        let streak = 1;
        const today = new Date().toDateString();
        // Determine if latest is today or yesterday
        const latest = uniqueDates[0];
        const isLatestTodayOrYest = 
          latest === today || 
          new Date(latest).getTime() === new Date(today).getTime() - 86400000;
          
        if (!isLatestTodayOrYest) return 0;

        for (let i = 0; i < uniqueDates.length - 1; i++) {
          const curr = new Date(uniqueDates[i]);
          const prev = new Date(uniqueDates[i + 1]);
          const diff = (curr.getTime() - prev.getTime()) / (1000 * 3600 * 24);
          if (diff === 1) streak++;
          else break;
        }

        return streak;
      },
    }),
    {
      name: 'checkin-storage',
    }
  )
);

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
  githubToken: string;
  gistId: string;
  isSyncing: boolean;
  
  // Actions
  checkIn: (id: number, note: string, rating: number) => void;
  startLesson: (id: number) => void;
  setGithubToken: (token: string) => void;
  setGistId: (id: string) => void;
  
  // Gist Actions
  syncWithGist: () => Promise<void>;
  fetchFromGist: () => Promise<void>;
  
  // Helpers
  getOverallProgress: () => { completed: number; total: number; percentage: number };
  getStreak: () => number;
}

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
      githubToken: '',
      gistId: '',
      isSyncing: false,

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

      setGithubToken: (token) => set({ githubToken: token }),
      setGistId: (id) => set({ gistId: id }),

      syncWithGist: async () => {
        const { githubToken, gistId, lessons } = get();
        if (!githubToken) throw new Error('未配置 GitHub Token');
        
        set({ isSyncing: true });
        try {
          const fileName = 'nce1-checkin-data.json';
          const content = JSON.stringify(lessons, null, 2);
          
          const method = gistId ? 'PATCH' : 'POST';
          const url = gistId 
            ? `https://api.github.com/gists/${gistId}` 
            : 'https://api.github.com/gists';

          const response = await fetch(url, {
            method,
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              description: '新概念英语第一册打卡数据',
              public: false,
              files: {
                [fileName]: { content }
              }
            })
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || '同步失败');
          }

          const data = await response.json();
          if (!gistId) {
            set({ gistId: data.id });
          }
        } finally {
          set({ isSyncing: false });
        }
      },

      fetchFromGist: async () => {
        const { githubToken, gistId } = get();
        if (!githubToken || !gistId) throw new Error('未配置 Token 或 Gist ID');

        set({ isSyncing: true });
        try {
          const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
            }
          });

          if (!response.ok) throw new Error('获取数据失败');

          const data = await response.json();
          const fileName = 'nce1-checkin-data.json';
          const file = data.files[fileName];
          
          if (file && file.content) {
            const remoteLessons = JSON.parse(file.content);
            set({ lessons: remoteLessons });
          } else {
            throw new Error('Gist 中未找到打卡数据文件');
          }
        } finally {
          set({ isSyncing: false });
        }
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
      // Ensure sync settings are persisted
      partialize: (state) => ({
        lessons: state.lessons,
        githubToken: state.githubToken,
        gistId: state.gistId,
      }),
    }
  )
);

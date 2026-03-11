export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  category?: string;
  publishDate?: string;
  price?: string;
  description?: string;
  readingStatus: 'READING' | 'FINISHED';
  progress?: number; // 0-100
  rating?: number; // 0-5
  notes?: string;
  createdAt?: string; // ISO date string
  intro?: string;
  toc?: string;
  authorIntro?: string;
  inside?: string;
  publisherReview?: string;
}

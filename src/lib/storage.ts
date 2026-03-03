import { Book, MOCK_BOOKS } from '@/types/book';

const STORAGE_KEY = 'book_journal_books';

export const getBooks = (): Book[] => {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Initialize with mock data if empty
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_BOOKS));
    return MOCK_BOOKS;
  }

  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse stored books', e);
    return [];
  }
};

export const getBookById = (id: string): Book | undefined => {
  const books = getBooks();
  return books.find(b => b.id === id);
};

export const saveBook = (book: Omit<Book, 'id'>): Book => {
  const books = getBooks();
  const newBook: Book = {
    ...book,
    id: Math.random().toString(36).substr(2, 9),
  };

  const updatedBooks = [newBook, ...books];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedBooks));
  return newBook;
};

export const updateBook = (updatedBook: Book): void => {
  const books = getBooks();
  const updatedBooks = books.map(b => b.id === updatedBook.id ? updatedBook : b);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedBooks));
};

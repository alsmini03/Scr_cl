'use server';

import { sql } from '@vercel/postgres';
import { Book } from '@/types/book';
import { revalidatePath } from 'next/cache';

function mapRowToBook(row: any): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author || '',
    coverImage: row.cover_image || '',
    category: row.category,
    publishDate: row.published_date,
    price: row.price,
    description: row.description,
    readingStatus: row.status as 'READING' | 'FINISHED',
    progress: row.progress,
    rating: row.rating,
    notes: row.notes,
    createdAt: row.added_at,
  };
}

export async function getBooks(): Promise<Book[]> {
  try {
    const { rows } = await sql`SELECT * FROM books ORDER BY added_at DESC`;
    return rows.map(mapRowToBook);
  } catch (error) {
    console.error('Failed to fetch books:', error);
    return [];
  }
}

export async function getBookById(id: string): Promise<Book | undefined> {
  try {
    const { rows } = await sql`SELECT * FROM books WHERE id = ${id}`;
    if (rows.length === 0) return undefined;
    return mapRowToBook(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch book with id ${id}:`, error);
    return undefined;
  }
}

export async function saveBook(book: Omit<Book, 'id'>): Promise<Book> {
  const id = Math.random().toString(36).substring(2, 11);
  const createdAt = new Date().toISOString();

  try {
    await sql`
      INSERT INTO books (
        id, title, author, cover_image, description, published_date,
        price, category, status, progress, rating, notes, added_at
      ) VALUES (
        ${id}, ${book.title}, ${book.author}, ${book.coverImage},
        ${book.description || null}, ${book.publishDate || null},
        ${book.price || null}, ${book.category || null},
        ${book.readingStatus}, ${book.progress || 0},
        ${book.rating || 0}, ${book.notes || null}, ${createdAt}
      )
    `;

    revalidatePath('/');
    return { ...book, id, createdAt };
  } catch (error) {
    console.error('Failed to save book:', error);
    throw new Error('Failed to save book');
  }
}

export async function updateBook(book: Book): Promise<void> {
  try {
    await sql`
      UPDATE books SET
        title = ${book.title},
        author = ${book.author},
        cover_image = ${book.coverImage},
        description = ${book.description || null},
        published_date = ${book.publishDate || null},
        price = ${book.price || null},
        category = ${book.category || null},
        status = ${book.readingStatus},
        progress = ${book.progress || 0},
        rating = ${book.rating || 0},
        notes = ${book.notes || null}
      WHERE id = ${book.id}
    `;
    revalidatePath('/');
    revalidatePath(`/book/${book.id}`);
  } catch (error) {
    console.error(`Failed to update book with id ${book.id}:`, error);
    throw new Error('Failed to update book');
  }
}

export async function deleteBook(id: string): Promise<void> {
  try {
    await sql`DELETE FROM books WHERE id = ${id}`;
    revalidatePath('/');
  } catch (error) {
    console.error(`Failed to delete book with id ${id}:`, error);
    throw new Error('Failed to delete book');
  }
}

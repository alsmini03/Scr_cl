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
}

export const MOCK_BOOKS: Book[] = [
  {
    id: '1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCUXqwzzixoCgov4vxbTnt57qCnoUsvIWL0U2nmmAmdOJEeutLW9PuBrXIE6zIexPcDbRnEiMievcw7Pjkq-LV-lxgyyo5IK0Y7owdKN7QEqfRsIoYjok8C0mytML4M0z71EcvnHYeywDwYhzOrw1unZ1QpNyLkY2JXYBRji-pgY7pkRTZsNuULj8gRkF6Cnl1EHEA7Nr1nk-TOqJs_EtE1JmBxrcZVoqpBz704CiLQG3ZqGK13Kny57kcdhlwxGCdYeQk6z1bC8-o',
    category: '소설 / 고전',
    publishDate: '1925년 4월 10일',
    price: '15,000원',
    description: '1920년대 미국을 배경으로 무너져가는 아메리칸 드림을 날카롭게 포착한 F. 스콧 피츠제럴드의 걸작입니다. 호화로운 파티 뒤에 숨겨진 공허함과, 옛 연인 데이지를 되찾으려는 제이 개츠비의 헌신적이고도 비극적인 사랑 이야기를 담고 있습니다.',
    readingStatus: 'READING',
    progress: 65,
  },
  {
    id: '2',
    title: 'Atomic Habits',
    author: 'James Clear',
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuACMUuAuAas0o9GAyW-M9lc03pozXjmvu0tpi19jj2fSXRKwxm2guFZqF4bIhLoVhilnDYS-WHpW8_Nxx2YgTimV2hQymbLAE7vJCFnTmzrs96WX-wNcgHnHZC15yXGsGry5XLT4aA5gtLP_SB200yq2MwrqxEqyWXB69jv0zsJX4gphT-K-mIsF3euldvJjHPHv4Ri_GI8qFw00lGCH3U0UedY0qWndySh02lQ0o1314Q_OmUi2SzPOmDjsDZAxMCdKYR6MzxOMNE',
    readingStatus: 'READING',
    progress: 22,
  },
  {
    id: '3',
    title: 'Dune',
    author: 'Frank Herbert',
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDoV8IDoACUzbXjbxgtTZlx0HZ5GIiQK_FskU8UymTcNMgvzj5DRKHlzRrvUb8LNnuLzqs254oXM3x_v6_zilrIrxylo3JNSsiRyZFYq_ReAcJYaUaviwxiVeg9pAZ9zA9dKU-Ps6dJJ-ob4aJEgF-MWfpR339TD4avLHPA__dACm0Z1uwyE4LcEDuha2J9ets291WIwFKtpAewKDggZ6s_Adg1gVC_b0MABgDZ8E-rIyq180-3hoch8YIJzhs8eLBtRETdCyQCd4M',
    readingStatus: 'READING',
    progress: 89,
  },
  {
    id: '4',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB09eX3m5V7te5UYCMMr1QePDucKPEuIiugNrBLcYB8GDubf23eQ14rmFKjBR8eiNykwRJzmNLWtUDikbq2nlqc769rCmi1RSBorQA2U5AumlW18HMqoN7YaV8OdUKN5pZ79Pak5p_q5LXk2fewqiP0DFR3IxxGmL8-AhiHKiNrtkLQ0QciRpr6-O391kd-echBQ4npJldlvzPwW999AYpbQx8bMiFEH9Mzdz1rmw-VCoeqjZMQmksPEkEpz9CYHGUH-bbEczVrP5Y',
    readingStatus: 'FINISHED',
    rating: 5.0,
  },
  {
    id: '5',
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQIRlXgSMsQ1EZWHV4itKfP-O9Eub0eLI3kKdCUcLdZ8t-KnFpw-8kUANyD3jGkyWYbFeln397Ta8p7Uk75luXO1qzZrXrZ32Evoq3RkXXpXLfKzjDCJ_V8X467KsxtvD6j4nqYfxcaCly-u3zVLu2J2N5oXIAGrWjrXObEVgl7DSudlUuJ7M8e4kGUJws9aiL-x6A65MEraTzIb1ORwxufJvfCVBvnNcvXqPFP54zxguEWULWgR7tqItRdWK38Pc8KNUjnhsLiNM',
    readingStatus: 'FINISHED',
    rating: 4.0,
  },
  {
    id: '6',
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDthv9XwqagFcJqy0MBe4TYaw5C03G7S7QX-Vj07vEmtKE5gqEhIsXcq6m7golfLFsehGaMi-eFcXfHWx5uhpyrewOHjtAJaPw8qxko-uqcPqCpIzBlVrG-AKMimpZBpj4pYvXC1jP15JXEPaQZAJxW-1E7iRjN-QTWuvCbl7NJXVcDkU3D6edFan4ajtnlbaxEFJAD-dfUpdVz40CllRrHcKkoyyIdjlYXJq8ja4iaQBt5PpBwGYqqhXeSJ9fuUhTN-uzJvEV3328',
    readingStatus: 'FINISHED',
    rating: 4.5,
  },
];

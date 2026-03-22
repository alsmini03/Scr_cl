import { getBlogs, getBlogTabs } from '@/lib/db';
import { auth } from '@/auth';
import BlogClient from '@/components/BlogClient';

export default async function BlogListPage() {
  const [session, blogs, tabs] = await Promise.all([
    auth(),
    getBlogs(),
    getBlogTabs()
  ]);

  return (
    <BlogClient
      session={session}
      initialBlogs={blogs}
      initialTabs={tabs}
    />
  );
}

import { Temporal } from 'temporal-polyfill';
import type { PageLoad } from './$types';

export type Metadata = {
  title: string, description?: string, image?: string, date?: string, tags?: string[],
}

const parseDate = (dateString: string) => {
  return Temporal.PlainDate.from(dateString.split('T')[0]);
}

export const load = (async () => {
  const posts = await Promise.all(
    Object.entries(import.meta.glob('./*/+page.*')).map(
      async ([path, resolver]) => {
        const data = await resolver() as { metadata: Metadata };
        console.log(path, data.metadata);

        const slug = path.split('/')[1];

        const date = parseDate(data?.metadata.date || '');

        return { ...data?.metadata, slug, date };
      }
    )
  );

  posts.sort((a, b) => Temporal.PlainDate.compare(b.date, a.date));

  console.log(posts);

  return { posts };

}) satisfies PageLoad;
import type { PageLoad } from './$types';

export type Metadata = {
  title: string, description: string, image: string, date: string, tags: string[],
}

export const load = (async () => {
  const posts = await Promise.all(
    Object.entries(import.meta.glob('./*/+page.*')).map(
      async ([path, resolver]) => {
        const data = await resolver() as { metadata: Metadata };
        const slug = path.split('/')[1];
        return { ...data.metadata, slug };
      }
    )
  );

  return { posts };

}) satisfies PageLoad;
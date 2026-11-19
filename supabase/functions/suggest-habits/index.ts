import bundledLessons from './lessons.json' with { type: 'json' };
import { createHandler } from './handler.mjs';

async function findLesson(number: number, url: string, anon: string, authorization: string) {
  const query = new URLSearchParams({
    curriculum_version: 'eq.2', number: `eq.${number}`, retired_at: 'is.null',
    select: 'title,summary:published_content->>summary', limit: '1',
  });
  const response = await fetch(`${url}/rest/v1/lessons?${query}`, {
    headers: { apikey: anon, Authorization: authorization }, signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    const error = await response.json();
    if (error.code === '42703') return bundledLessons.find(lesson => lesson.n === number);
    throw new Error('Unable to load the published lesson.');
  }
  const [lesson] = await response.json();
  return lesson?.summary ? { n: number, title: lesson.title, summary: lesson.summary } : undefined;
}

Deno.serve(createHandler({ env: (name: string) => Deno.env.get(name), lessons: bundledLessons, findLesson }));

import { redirect } from 'next/navigation';

// Every role lands on its dashboard after sign-in (FR-DSH-01). Without a session cookie,
// src/proxy.ts sends the visitor to /login first.
export default function Home() {
  redirect('/dashboard');
}

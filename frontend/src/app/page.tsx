import { redirect } from 'next/navigation';

// Every role lands on its dashboard after sign-in (FR-DSH-01). The dashboard arrives in P2.
export default function Home() {
  redirect('/login');
}

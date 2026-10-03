import { Suspense } from 'react';
import { SystemStatus } from '@/components/system-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Fernleaf Kitchen Ops</CardTitle>
          <CardDescription>Sign in with your staff account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* useSearchParams (for ?next=) needs a Suspense boundary in the App Router. */}
          <Suspense>
            <LoginForm />
          </Suspense>
          <SystemStatus />
        </CardContent>
      </Card>
    </main>
  );
}

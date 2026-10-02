import { SystemStatus } from '@/components/system-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Placeholder until P2 (T-205) adds the real sign-in form.
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Fernleaf Kitchen Ops</CardTitle>
          <CardDescription>Sign-in arrives in the next phase.</CardDescription>
        </CardHeader>
        <CardContent>
          <SystemStatus />
        </CardContent>
      </Card>
    </main>
  );
}

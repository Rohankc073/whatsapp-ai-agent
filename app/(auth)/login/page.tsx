import { Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <MessageCircle className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Sign in to WhatsApp Agent</h1>
          <p className="mt-1 text-sm text-muted">Manage your AI replies and conversations</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

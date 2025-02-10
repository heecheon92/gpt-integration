// clerk expects the sign-in page to be at
// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <SignIn
        appearance={{ variables: { colorPrimary: "#0F172A" } }}
        fallbackRedirectUrl={"/notes"}
      />
    </div>
  );
}

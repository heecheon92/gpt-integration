// clerk expects the sign-in page to be at
// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <SignUp
        appearance={{ variables: { colorPrimary: "#0F172A" } }}
        fallbackRedirectUrl={"/services/notes"}
      />
    </div>
  );
}

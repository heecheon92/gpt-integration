import { Metadata } from "next";

export const metadata: Metadata = {
  title: "FlowBrain - Sign In",
};
export default async function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "FlowBrain - Sign Up",
};
export default async function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

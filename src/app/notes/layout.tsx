import { Metadata } from "next";
import { NavBar } from "./NavBar";

export const metadata: Metadata = {
  title: "FlowBrain - Notes",
};
export default async function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NavBar />
      <main className="m-auto max-w-7xl p-4">{children}</main>
    </>
  );
}

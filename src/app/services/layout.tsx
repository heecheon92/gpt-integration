import { Metadata } from "next";
import { NavBar } from "./components/NavBar";

export const metadata: Metadata = {
  title: "FlowBrain - Services",
};
export default async function ServicesLayout({
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

import dynamic from "next/dynamic";
import React from "react";

export const NoSSR = dynamic(
  () =>
    Promise.resolve(function NoSsr({
      children,
    }: {
      children: React.ReactNode;
    }) {
      return <>{children}</>;
    }),
  {
    ssr: false,
  },
);

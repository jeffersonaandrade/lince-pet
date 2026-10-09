import { Suspense } from "react";
import VeterinarioSignup from "./components/VeterinarioSignup";

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <VeterinarioSignup />
    </Suspense>
  );
}

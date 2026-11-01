import { createFileRoute } from "@tanstack/react-router";
import { ParkingGame } from "@/components/game/parking-game";

export const Route = createFileRoute("/")({
  // The simulation owns browser-local state and mounts after hydration.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Parkside — De la place pour vos idées" },
      {
        name: "description",
        content:
          "Un petit coin de ville à imaginer. Construisez votre parking, prenez soin des clients et développez votre entreprise dans Parkside.",
      },
      { name: "theme-color", content: "#fdfdf9" },
    ],
  }),
  component: ParkingGame,
});

import { createFileRoute } from "@tanstack/react-router";
import { ParkingGame } from "@/components/game/parking-game";

export const Route = createFileRoute("/")({
  // The simulation owns browser-local state and mounts after hydration.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Parkside — Parking builder" },
      {
        name: "description",
        content: "Construisez et gérez vos parkings dans Parkside.",
      },
      { name: "theme-color", content: "#fdfdf9" },
    ],
  }),
  component: ParkingGame,
});

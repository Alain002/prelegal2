import { screen, within } from "@testing-library/react";

/** Queries scoped to the agreement preview. */
export const preview = () => within(screen.getByRole("region", { name: "Agreement preview" }));

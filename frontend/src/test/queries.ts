import { screen, within } from "@testing-library/react";

/** Queries scoped to a labelled fieldset, e.g. group("Party 1"). */
export const group = (name: string) => within(screen.getByRole("group", { name }));

/** Queries scoped to the agreement preview. */
export const preview = () => within(screen.getByRole("region", { name: "Agreement preview" }));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function Boom(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders a fallback and resets back to children", async () => {
    const user = userEvent.setup();
    const Recoverable = ({ crash }: { crash: boolean }) =>
      crash ? <Boom /> : <div>reader ok</div>;

    const { rerender } = render(
      <ErrorBoundary>
        <Recoverable crash={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("reader ok")).toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <Recoverable crash />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "出错了" })).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重试" }));

    rerender(
      <ErrorBoundary>
        <Recoverable crash={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("reader ok")).toBeInTheDocument();
  });
});

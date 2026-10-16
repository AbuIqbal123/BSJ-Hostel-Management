import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { useDelayedLoading } from "@/use-delayed-loading";

function Probe({ loading, error }: { loading: boolean; error: boolean }) {
  const show = useDelayedLoading(loading);
  const label = error ? "retry" : show ? "skeleton" : "content";
  return createElement("span", null, label);
}

function textOf(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root.findByType("span").props.children;
}

describe("useDelayedLoading", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps the previous content when the load finishes within the delay", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(Probe, { loading: true, error: false }));
    });
    act(() => {
      jest.advanceTimersByTime(199);
    });
    expect(textOf(renderer!)).toBe("content");
    act(() => {
      renderer.update(createElement(Probe, { loading: false, error: false }));
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(textOf(renderer!)).toBe("content");
  });

  it("shows a skeleton once the load is still going after the delay", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(Probe, { loading: true, error: false }));
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(textOf(renderer!)).toBe("skeleton");
  });

  it("keeps that skeleton up for the minimum visible time", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(Probe, { loading: true, error: false }));
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    act(() => {
      renderer.update(createElement(Probe, { loading: false, error: false }));
    });
    act(() => {
      jest.advanceTimersByTime(399);
    });
    expect(textOf(renderer!)).toBe("skeleton");
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(textOf(renderer!)).toBe("content");
  });

  it("shows a retry immediately when the load fails", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(Probe, { loading: true, error: false }));
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(textOf(renderer!)).toBe("skeleton");
    act(() => {
      renderer.update(createElement(Probe, { loading: false, error: true }));
    });
    expect(textOf(renderer!)).toBe("retry");
  });
});

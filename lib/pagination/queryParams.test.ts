import { describe, expect, it } from "vitest";

import { buildListQueryString, parseListQueryParams } from "./queryParams";

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parseListQueryParams", () => {
  it("defaults page to 1 and pageSize to 25 when absent", () => {
    const result = parseListQueryParams(params(""));
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.sortDir).toBe("asc");
  });

  it("clamps pageSize to the maximum", () => {
    const result = parseListQueryParams(params("pageSize=99999"));
    expect(result.pageSize).toBe(200);
  });

  it("falls back to defaults for non-numeric or non-positive page/pageSize", () => {
    expect(parseListQueryParams(params("page=abc")).page).toBe(1);
    expect(parseListQueryParams(params("page=0")).page).toBe(1);
    expect(parseListQueryParams(params("page=-5")).page).toBe(1);
    expect(parseListQueryParams(params("pageSize=0")).pageSize).toBe(25);
  });

  it("truncates a fractional page to a whole number", () => {
    expect(parseListQueryParams(params("page=2.9")).page).toBe(2);
  });

  it("treats sortDir other than 'desc' as 'asc'", () => {
    expect(parseListQueryParams(params("sortDir=desc")).sortDir).toBe("desc");
    expect(parseListQueryParams(params("sortDir=bogus")).sortDir).toBe("asc");
  });

  it("collects unknown query params as filters, excluding reserved keys", () => {
    const result = parseListQueryParams(
      params(
        "page=2&pageSize=10&search=x&sort=name&sortDir=desc&countOnly=1&category=snacks&store=abc",
      ),
    );
    expect(result.filters).toEqual({ category: "snacks", store: "abc" });
  });

  it("drops empty-string filter values", () => {
    const result = parseListQueryParams(params("category="));
    expect(result.filters).toEqual({});
  });
});

describe("buildListQueryString", () => {
  it("round-trips through parseListQueryParams", () => {
    const qs = buildListQueryString({
      page: 3,
      pageSize: 50,
      search: "lays",
      sort: "name",
      sortDir: "desc",
      filters: { category: "snacks" },
    });
    const parsed = parseListQueryParams(params(qs));
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.search).toBe("lays");
    expect(parsed.sort).toBe("name");
    expect(parsed.sortDir).toBe("desc");
    expect(parsed.filters).toEqual({ category: "snacks" });
  });

  it("omits countOnly when not requested and sets it to 1 when requested", () => {
    expect(buildListQueryString({ page: 1 })).not.toContain("countOnly");
    expect(buildListQueryString({ page: 1, countOnly: true })).toContain("countOnly=1");
  });

  it("skips undefined and empty filter values", () => {
    const qs = buildListQueryString({ filters: { a: "1", b: "", c: undefined } });
    const parsed = parseListQueryParams(params(qs));
    expect(parsed.filters).toEqual({ a: "1" });
  });
});
